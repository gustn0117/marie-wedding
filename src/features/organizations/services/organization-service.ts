import { createClient } from '@/lib/supabase/client';
import type { Organization, OrganizationMember, OrganizationMemberRole } from '@/types/database';

const ERROR_MAP: Record<string, string> = {
  unauthorized: '로그인이 필요합니다.',
  name_required: '조직 이름을 입력해 주세요.',
  invalid_role: '유효하지 않은 권한입니다.',
  cannot_invite_self: '본인을 초대할 수 없습니다.',
  already_member: '이미 조직에 속한 사용자입니다.',
  already_accepted: '이미 수락된 초대입니다.',
  not_your_invite: '본인의 초대만 수락할 수 있습니다.',
  not_authorized_to_invite: '초대 권한이 없습니다 (owner/manager만 가능).',
  only_owner_can_change_role: '오너만 권한을 변경할 수 있습니다.',
  cannot_change_owner_role: '오너 권한은 변경할 수 없습니다.',
  cannot_remove_owner: '오너는 제거할 수 없습니다.',
  member_not_found: '멤버 정보를 찾을 수 없습니다.',
  invite_not_found: '초대 정보를 찾을 수 없습니다.',
  not_authorized: '권한이 없습니다.',
};

function translateOrgError(message: string): string {
  for (const [code, kr] of Object.entries(ERROR_MAP)) {
    if (message.includes(code)) return kr;
  }
  return message;
}

export const organizationService = {
  async listMine(profileId: string): Promise<Organization[]> {
    const supabase = createClient();
    // 본인이 owner인 조직 + 본인이 멤버인 조직 union
    const { data: owned } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_profile_id', profileId)
      .is('deleted_at', null);
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization:organizations(*)')
      .eq('member_profile_id', profileId)
      .is('deleted_at', null)
      .not('accepted_at', 'is', null);

    // PostgREST embed는 1:1 관계도 array로 반환할 수 있어 안전하게 풀어줌
    const orgsFromMemberships = ((memberships ?? []) as unknown as Array<{ organization: Organization | Organization[] | null }>)
      .map((m) => Array.isArray(m.organization) ? m.organization[0] : m.organization)
      .filter((o): o is Organization => !!o && o.deleted_at === null);

    // dedup
    const seen = new Set<string>();
    const merged: Organization[] = [];
    for (const o of [...((owned ?? []) as Organization[]), ...orgsFromMemberships]) {
      if (!seen.has(o.id)) { seen.add(o.id); merged.push(o); }
    }
    return merged;
  },

  async getById(id: string): Promise<Organization | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    return (data ?? null) as Organization | null;
  },

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('organization_members')
      .select(`*, member:profiles!member_profile_id(id, company_name, contact_name, profile_image)`)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('role', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(translateOrgError(error.message));
    return (data ?? []) as unknown as OrganizationMember[];
  },

  async pendingInvitesForMe(profileId: string): Promise<OrganizationMember[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('organization_members')
      .select(`*, organization:organizations(*)`)
      .eq('member_profile_id', profileId)
      .is('accepted_at', null)
      .is('deleted_at', null);
    if (error) throw new Error(translateOrgError(error.message));
    return (data ?? []) as unknown as OrganizationMember[];
  },

  async create(input: { name: string; businessNumber?: string; representativeName?: string; address?: string }): Promise<Organization> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_organization', {
      p_name: input.name,
      p_business_number: input.businessNumber ?? null,
      p_representative_name: input.representativeName ?? null,
      p_address: input.address ?? null,
    });
    if (error) throw new Error(translateOrgError(error.message));
    return data as Organization;
  },

  async invite(organizationId: string, memberProfileId: string, role: 'manager' | 'staff'): Promise<OrganizationMember> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('invite_organization_member', {
      p_org_id: organizationId,
      p_member_profile_id: memberProfileId,
      p_role: role,
    });
    if (error) throw new Error(translateOrgError(error.message));
    return data as OrganizationMember;
  },

  async acceptInvite(memberId: string): Promise<OrganizationMember> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('accept_organization_invite', { p_member_id: memberId });
    if (error) throw new Error(translateOrgError(error.message));
    return data as OrganizationMember;
  },

  async updateRole(memberId: string, newRole: 'manager' | 'staff'): Promise<OrganizationMember> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('update_member_role', { p_member_id: memberId, p_new_role: newRole });
    if (error) throw new Error(translateOrgError(error.message));
    return data as OrganizationMember;
  },

  async remove(memberId: string): Promise<OrganizationMember> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('remove_organization_member', { p_member_id: memberId });
    if (error) throw new Error(translateOrgError(error.message));
    return data as OrganizationMember;
  },

  async myRole(organizationId: string, profileId: string): Promise<OrganizationMemberRole | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('member_profile_id', profileId)
      .is('deleted_at', null)
      .not('accepted_at', 'is', null)
      .maybeSingle();
    return (data?.role as OrganizationMemberRole) ?? null;
  },
};
