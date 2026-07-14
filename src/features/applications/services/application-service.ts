import { createClient } from '@/lib/supabase/client';
import { apiFetch } from '@/shared/utils/apiFetch';
import type { Application, ApplicationStatus } from '@/types/database';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: '접수',
  reviewing: '검토 중',
  accepted: '승인',
  rejected: '거절',
  cancelled: '취소',
};

export function translateApplicationStatusError(msg: string): string {
  if (msg.includes('status_not_allowed_for_author')) return '공고 작성자는 이 상태로 변경할 수 없습니다.';
  if (msg.includes('status_not_allowed_for_applicant')) return '지원자는 취소만 가능합니다.';
  if (msg.includes('cannot_cancel_final_status')) return '이미 처리된 신청은 취소할 수 없습니다.';
  if (msg.includes('cannot_change_cancelled_application')) return '취소된 지원은 상태를 변경할 수 없습니다.';
  if (msg.includes('cannot_change_completed_deal')) return '완료된 거래는 상태를 변경할 수 없습니다.';
  if (msg.includes('not_party_to_application')) return '권한이 없습니다.';
  if (msg.includes('application_not_found')) return '신청 정보를 찾을 수 없습니다.';
  if (msg.includes('job_not_found')) return '공고를 찾을 수 없습니다.';
  if (msg.includes('unauthorized')) return '로그인이 필요합니다.';
  return '상태 변경에 실패했습니다.';
}

export const applicationService = {
  async getApplicationForJob(jobId: string, applicantId: string): Promise<Application | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('applications')
      .select(`*, job:jobs(*, author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS})), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('job_id', jobId)
      .eq('applicant_id', applicantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data as Application | null;
  },

  async getReceivedApplications(profileId: string): Promise<Application[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('applications')
      // 탈퇴한 지원자의 PII 노출 방지 — applicant.deleted_at IS NULL 필터
      .select(`*, job:jobs!inner(*), applicant:profiles!inner(${PUBLIC_PROFILE_COLUMNS})`)
      .is('deleted_at', null)
      .is('applicant.deleted_at', null)
      .eq('job.author_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Application[];
  },

  async getApplicationsForJob(jobId: string): Promise<Application[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('applications')
      // 서버측에서 job_id 로 필터 + job 임베드 제거(공고 본문 HTML 비용 제거).
      // 탈퇴한 지원자의 PII 노출 방지 — applicant.deleted_at IS NULL 필터.
      .select(`*, applicant:profiles!inner(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .is('applicant.deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return (data ?? []) as Application[];
  },

  async getSentApplications(profileId: string): Promise<Application[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('applications')
      // 삭제된 공고 / 탈퇴한 공고 작성자 표시 X
      .select(`*, job:jobs!inner(*), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .is('deleted_at', null)
      .is('job.deleted_at', null)
      .eq('applicant_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Application[];
  },

  async createApplication(input: {
    jobId: string;
    applicantId: string;
    message: string;
    contactPhone?: string;
  }): Promise<Application> {
    // service_role 서버 라우트 경유 — 클라이언트 .insert().select().single() 의
    // RLS/트리거 hang 회피, 즉시 응답.
    const res = await apiFetch('/api/applications/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: input.jobId, message: input.message, contactPhone: input.contactPhone }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || '접수에 실패했습니다.');
    }
    const { data } = await res.json();
    return data as Application;
  },

  async updateStatus(id: string, status: ApplicationStatus): Promise<Application> {
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('set_application_status', {
      p_application_id: id,
      p_status: status,
    });
    if (rpcError) throw new Error(translateApplicationStatusError(rpcError.message));

    const { data, error: fetchError } = await supabase
      .from('applications')
      .select(`*, job:jobs(*), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    return data as Application;
  },

  async markCompleted(id: string): Promise<Application> {
    const supabase = createClient();
    const { error } = await supabase.rpc('mark_deal_completed', { p_application_id: id });
    if (error) throw error;
    const { data, error: fetchErr } = await supabase
      .from('applications')
      .select(`*, job:jobs(*), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;
    return data as Application;
  },

  async setAuthorNote(id: string, note: string): Promise<Application> {
    const supabase = createClient();
    const { error } = await supabase.rpc('set_author_note', { p_application_id: id, p_note: note });
    if (error) throw error;
    const { data, error: fetchErr } = await supabase
      .from('applications')
      .select(`*, job:jobs(*), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;
    return data as Application;
  },
};
