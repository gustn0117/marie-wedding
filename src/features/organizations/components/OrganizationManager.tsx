'use client';

import { useCallback, useEffect, useState } from 'react';
import { organizationService } from '../services/organization-service';
import type { Organization, OrganizationMember, OrganizationMemberRole } from '@/types/database';
import { ORGANIZATION_MEMBER_ROLE_LABELS } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { toast, toastConfirm } from '@/shared/components/Toast';
import EmptyState from '@/shared/components/EmptyState';

const ROLE_TONES: Record<OrganizationMemberRole, string> = {
  owner: 'bg-primary-50 text-primary border-primary-200',
  manager: 'bg-blue-50 text-blue-700 border-blue-200',
  staff: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function OrganizationManager({ profileId }: { profileId: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pendingInvites, setPendingInvites] = useState<OrganizationMember[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [myRole, setMyRole] = useState<OrganizationMemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const [orgs, invites] = await Promise.all([
        organizationService.listMine(profileId),
        organizationService.pendingInvitesForMe(profileId),
      ]);
      setOrganizations(orgs);
      setPendingInvites(invites);
      if (!activeOrgId && orgs.length > 0) {
        setActiveOrgId(orgs[0].id);
      } else if (activeOrgId && !orgs.find((o) => o.id === activeOrgId)) {
        setActiveOrgId(orgs[0]?.id ?? null);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '조직 정보 로드 실패', 'error');
    } finally {
      setLoading(false);
    }
  }, [profileId, activeOrgId]);

  const loadMembers = useCallback(async () => {
    if (!activeOrgId) { setMembers([]); setMyRole(null); return; }
    try {
      const [m, r] = await Promise.all([
        organizationService.listMembers(activeOrgId),
        organizationService.myRole(activeOrgId, profileId),
      ]);
      setMembers(m);
      setMyRole(r);
    } catch (err) {
      toast(err instanceof Error ? err.message : '멤버 로드 실패', 'error');
    }
  }, [activeOrgId, profileId]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  const activeOrg = organizations.find((o) => o.id === activeOrgId);
  const canManage = myRole === 'owner' || myRole === 'manager';
  const canChangeRoles = myRole === 'owner';

  const handleAccept = async (memberId: string) => {
    try {
      await organizationService.acceptInvite(memberId);
      toast('초대를 수락했습니다.', 'success');
      await loadOrgs();
    } catch (err) {
      toast(err instanceof Error ? err.message : '수락 실패', 'error');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'manager' | 'staff') => {
    try {
      await organizationService.updateRole(memberId, newRole);
      toast('권한이 변경되었습니다.', 'success');
      await loadMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : '권한 변경 실패', 'error');
    }
  };

  const handleRemove = async (member: OrganizationMember) => {
    const isSelf = member.member_profile_id === profileId;
    const ok = await toastConfirm(isSelf ? '조직에서 탈퇴합니다. 계속하시겠습니까?' : `${member.member?.company_name ?? member.member?.contact_name ?? '이 멤버'}를 조직에서 제거합니다.`);
    if (!ok) return;
    try {
      await organizationService.remove(member.id);
      toast(isSelf ? '탈퇴했습니다.' : '제거되었습니다.', 'success');
      await Promise.all([loadOrgs(), loadMembers()]);
    } catch (err) {
      toast(err instanceof Error ? err.message : '처리 실패', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 받은 초대 */}
      {pendingInvites.length > 0 && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-bold text-blue-900 mb-3">받은 초대 ({pendingInvites.length})</h2>
          <ul className="space-y-2">
            {pendingInvites.map((inv) => {
              const org = (inv as OrganizationMember & { organization?: Organization }).organization;
              return (
                <li key={inv.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                  <div>
                    <p className="text-sm font-bold text-ink">{org?.name ?? '조직'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className={`inline-flex items-center rounded text-[10px] px-1.5 py-0.5 font-bold border ${ROLE_TONES[inv.role]} mr-1`}>
                        {ORGANIZATION_MEMBER_ROLE_LABELS[inv.role]}
                      </span>
                      권한으로 초대받음
                    </p>
                  </div>
                  <button type="button" onClick={() => handleAccept(inv.id)} className="btn-primary text-xs">수락</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-12 bg-gray-100 rounded animate-pulse" />
          <div className="h-32 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : organizations.length === 0 ? (
        <>
          {showCreateForm ? (
            <CreateOrganizationForm onCancel={() => setShowCreateForm(false)} onCreated={async () => { setShowCreateForm(false); await loadOrgs(); }} />
          ) : (
            <EmptyState
              title="아직 등록된 조직이 없습니다"
              description="조직을 만들면 직원에게 권한을 부여하고 함께 견적·계약·정산을 관리할 수 있습니다."
              actionLabel="조직 만들기"
              actionHref="#create"
            />
          )}
          {!showCreateForm && (
            <div className="text-center">
              <button type="button" onClick={() => setShowCreateForm(true)} className="btn-primary text-sm">
                + 조직 만들기
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 조직 탭 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
            <div role="tablist" className="flex gap-1 overflow-x-auto">
              {organizations.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="tab"
                  aria-selected={activeOrgId === o.id}
                  onClick={() => setActiveOrgId(o.id)}
                  className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                    activeOrgId === o.id ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {o.name}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowCreateForm(true)} className="text-xs text-gray-500 hover:text-ink font-bold">
              + 새 조직
            </button>
          </div>

          {showCreateForm && (
            <CreateOrganizationForm onCancel={() => setShowCreateForm(false)} onCreated={async () => { setShowCreateForm(false); await loadOrgs(); }} />
          )}

          {/* 활성 조직 정보 */}
          {activeOrg && (
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink">{activeOrg.name}</h2>
                  {activeOrg.business_number && <p className="text-xs text-gray-500 mt-1">사업자 {activeOrg.business_number}</p>}
                  {activeOrg.representative_name && <p className="text-xs text-gray-500">대표 {activeOrg.representative_name}</p>}
                </div>
                {myRole && (
                  <span className={`inline-flex items-center rounded text-[11px] px-2 py-0.5 font-bold border ${ROLE_TONES[myRole]}`}>
                    내 권한: {ORGANIZATION_MEMBER_ROLE_LABELS[myRole]}
                  </span>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-ink">멤버 ({members.length})</h3>
                  {canManage && !showInviteForm && (
                    <button type="button" onClick={() => setShowInviteForm(true)} className="btn-outline text-xs">+ 멤버 초대</button>
                  )}
                </div>

                {showInviteForm && (
                  <InviteForm
                    organizationId={activeOrg.id}
                    onCancel={() => setShowInviteForm(false)}
                    onInvited={async () => { setShowInviteForm(false); await loadMembers(); }}
                  />
                )}

                <ul className="divide-y divide-gray-100 mt-2">
                  {members.map((m) => {
                    const isSelf = m.member_profile_id === profileId;
                    return (
                      <li key={m.id} className="py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400 shrink-0">
                          {(m.member?.company_name || m.member?.contact_name || '?').charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-ink truncate">
                            {m.member?.company_name || m.member?.contact_name || '미상'}
                            {isSelf && <span className="text-xs text-gray-400 ml-1">(나)</span>}
                          </p>
                          {!m.accepted_at && <p className="text-xs text-amber-700">초대 수락 대기 중</p>}
                        </div>
                        <span className={`inline-flex items-center rounded text-[10px] px-1.5 py-0.5 font-bold border ${ROLE_TONES[m.role]} shrink-0`}>
                          {ORGANIZATION_MEMBER_ROLE_LABELS[m.role]}
                        </span>
                        {canChangeRoles && m.role !== 'owner' && !isSelf && (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as 'manager' | 'staff')}
                            className="text-xs h-7 px-2 rounded border border-gray-300 bg-white font-semibold"
                          >
                            <option value="staff">스태프</option>
                            <option value="manager">매니저</option>
                          </select>
                        )}
                        {(canManage || isSelf) && m.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={() => handleRemove(m)}
                            className="text-xs text-gray-400 hover:text-rose-600 font-bold"
                          >
                            {isSelf ? '탈퇴' : '제거'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CreateOrganizationForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await organizationService.create({
        name: name.trim(),
        businessNumber: businessNumber.trim() || undefined,
        representativeName: representativeName.trim() || undefined,
      });
      toast('조직을 생성했습니다.', 'success');
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : '생성 실패', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <h3 className="text-sm font-bold text-ink mb-1">새 조직 만들기</h3>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="조직(업체) 이름 *" required className="input" />
      <input type="text" value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} placeholder="사업자등록번호 (선택)" className="input" />
      <input type="text" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} placeholder="대표자명 (선택)" className="input" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-outline text-sm">취소</button>
        <button type="submit" disabled={submitting || !name.trim()} className="btn-primary text-sm">
          {submitting ? '생성 중...' : '생성'}
        </button>
      </div>
    </form>
  );
}

function InviteForm({ organizationId, onCancel, onInvited }: { organizationId: string; onCancel: () => void; onInvited: () => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [role, setRole] = useState<'manager' | 'staff'>('staff');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const supabase = createClient();
      const term = search.replace(/[,%_]/g, ' ').trim();
      const { data } = await supabase
        .from('profiles')
        .select('id, company_name, contact_name')
        .is('deleted_at', null)
        .or(`company_name.ilike.%${term}%,contact_name.ilike.%${term}%`)
        .limit(10);
      setResults(((data ?? []) as Array<{ id: string; company_name: string | null; contact_name: string }>).map((p) => ({
        id: p.id,
        label: p.company_name || p.contact_name,
      })));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await organizationService.invite(organizationId, selectedId, role);
      toast(`${selectedLabel}님을 초대했습니다.`, 'success');
      onInvited();
    } catch (err) {
      toast(err instanceof Error ? err.message : '초대 실패', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3 mb-3">
      <h4 className="text-sm font-bold text-ink">멤버 초대</h4>
      {selectedId ? (
        <div className="flex items-center justify-between p-2 bg-white rounded">
          <span className="text-sm font-semibold text-ink">{selectedLabel}</span>
          <button type="button" onClick={() => { setSelectedId(null); setSelectedLabel(''); setSearch(''); }} className="text-xs text-gray-500 hover:text-rose-600">변경</button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름/회사명으로 검색 (2자 이상)"
            className="input"
          />
          {results.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(r.id); setSelectedLabel(r.label); setResults([]); setSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="text-xs font-bold text-gray-600">권한</label>
        <select value={role} onChange={(e) => setRole(e.target.value as 'manager' | 'staff')} className="text-xs h-8 px-2 rounded border border-gray-300 bg-white font-semibold">
          <option value="staff">스태프 (조회만)</option>
          <option value="manager">매니저 (편집·초대)</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-outline text-xs">취소</button>
        <button type="submit" disabled={!selectedId || submitting} className="btn-primary text-xs">
          {submitting ? '초대 중...' : '초대 발송'}
        </button>
      </div>
    </form>
  );
}
