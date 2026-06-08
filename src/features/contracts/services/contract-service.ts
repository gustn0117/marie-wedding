import { createClient } from '@/lib/supabase/client';
import type { Contract, ContractStatus } from '@/types/database';

const CONTRACT_WITH_RELATIONS = `
  *,
  signatures:contract_signatures(*),
  party_a:profiles!party_a_profile_id(id, company_name, contact_name, profile_image, verification_status),
  party_b:profiles!party_b_profile_id(id, company_name, contact_name, profile_image, verification_status),
  quotation:quotations(*, items:quotation_items(*))
`;

const ERROR_MAP: Record<string, string> = {
  unauthorized: '로그인이 필요합니다.',
  contract_not_found: '계약을 찾을 수 없습니다.',
  not_party_to_contract: '계약 당사자만 가능합니다.',
  already_signed: '이미 서명했습니다.',
  contract_not_signed: '서명이 완료된 계약만 예약할 수 있습니다.',
  booking_already_exists: '이미 예약이 등록된 계약입니다.',
};

function translateContractError(message: string): string {
  for (const [code, kr] of Object.entries(ERROR_MAP)) {
    if (message.includes(code)) return kr;
  }
  if (message.includes('invalid_status_for_signing')) return '서명할 수 없는 상태입니다.';
  if (message.includes('invalid_status_for_cancel')) return '취소할 수 없는 상태입니다.';
  if (message.includes('invalid_status_for_progress')) return '진행 처리할 수 없는 상태입니다.';
  if (message.includes('invalid_status_for_complete')) return '완료 처리할 수 없는 상태입니다.';
  return message;
}

export interface ContractFilters {
  status?: ContractStatus;
  side?: 'party_a' | 'party_b' | 'all';
  search?: string;
}

export const contractService = {
  async list(profileId: string, filters: ContractFilters = {}, page = 1, pageSize = 20): Promise<{ data: Contract[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('contracts')
      .select(CONTRACT_WITH_RELATIONS, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.side === 'party_a') {
      query = query.eq('party_a_profile_id', profileId);
    } else if (filters.side === 'party_b') {
      query = query.eq('party_b_profile_id', profileId);
    } else {
      query = query.or(`party_a_profile_id.eq.${profileId},party_b_profile_id.eq.${profileId}`);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) query = query.ilike('title', `%${filters.search.replace(/[,%_]/g, ' ').trim()}%`);

    const { data, error, count } = await query;
    if (error) throw new Error(translateContractError(error.message));
    return { data: (data ?? []) as unknown as Contract[], count: count ?? 0 };
  },

  async getById(id: string): Promise<Contract | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contracts')
      .select(CONTRACT_WITH_RELATIONS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(translateContractError(error.message));
    return (data ?? null) as Contract | null;
  },

  async sign(id: string): Promise<Contract> {
    const supabase = createClient();
    const ua = typeof window !== 'undefined' ? window.navigator.userAgent.slice(0, 200) : null;
    const { data, error } = await supabase.rpc('sign_contract', {
      p_contract_id: id,
      p_ip_address: null, // 서버 측에서 추출 필요 (현재는 client 호출이라 null)
      p_user_agent: ua,
    });
    if (error) throw new Error(translateContractError(error.message));
    return data as Contract;
  },

  async cancel(id: string, reason?: string): Promise<Contract> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('cancel_contract', {
      p_contract_id: id,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(translateContractError(error.message));
    return data as Contract;
  },

  async markInProgress(id: string): Promise<Contract> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('mark_contract_in_progress', { p_contract_id: id });
    if (error) throw new Error(translateContractError(error.message));
    return data as Contract;
  },

  async complete(id: string): Promise<Contract> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('complete_contract', { p_contract_id: id });
    if (error) throw new Error(translateContractError(error.message));
    return data as Contract;
  },

  async createBooking(
    contractId: string,
    options: { providerSide?: 'party_a' | 'party_b'; startTime?: string; endTime?: string; note?: string } = {},
  ): Promise<{ booking_id: string }> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_booking_from_contract', {
      p_contract_id: contractId,
      p_provider_side: options.providerSide ?? 'party_b',
      p_start_time: options.startTime ?? null,
      p_end_time: options.endTime ?? null,
      p_note: options.note ?? null,
    });
    if (error) throw new Error(translateContractError(error.message));
    return { booking_id: (data as { id: string }).id };
  },
};
