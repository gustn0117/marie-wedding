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

const APPLICANT_APPLICATION_COLUMNS =
  'id, job_id, applicant_id, resume_id, message, contact_phone, status, created_at, updated_at, deleted_at, hiring_completed_at, applicant_completed_at, first_responded_at' as const;

type ApplicationAudience = 'applicant' | 'hiring';

function redactAuthorNote(row: unknown): Application {
  return { ...(row as Application), author_note: null };
}

export interface HiringApplicationPage {
  applications: Application[];
  nextCursor: string | null;
}

async function fetchHiringApplications(query = ''): Promise<HiringApplicationPage> {
  const response = await apiFetch(`/api/applications/hiring${query}`, { credentials: 'include' }, 10_000);
  const body = await response.json().catch(() => ({})) as {
    applications?: Application[];
    nextCursor?: string | null;
    error?: string;
  };
  if (!response.ok) throw new Error(body.error || '지원서를 불러오지 못했습니다.');
  return {
    applications: Array.isArray(body.applications) ? body.applications : [],
    nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : null,
  };
}

async function fetchHiringApplication(id: string): Promise<Application> {
  const response = await apiFetch(
    `/api/applications/hiring?applicationId=${encodeURIComponent(id)}`,
    { credentials: 'include' },
    10_000,
  );
  const body = await response.json().catch(() => ({})) as { application?: Application; error?: string };
  if (!response.ok || !body.application) throw new Error(body.error || '지원서를 불러오지 못했습니다.');
  return body.application;
}

export const applicationService = {
  async getApplicationForJob(jobId: string, applicantId: string): Promise<Application | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('applications')
      .select(`${APPLICANT_APPLICATION_COLUMNS}, job:jobs(*, author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS})), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('job_id', jobId)
      .eq('applicant_id', applicantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data ? redactAuthorNote(data) : null;
  },

  async getReceivedApplications(): Promise<Application[]> {
    // author_note는 브라우저 DB 역할에 SELECT 권한이 없다. 서버가 인증된
    // 공고 작성자를 다시 확인한 뒤 필요한 채용 측 payload만 반환한다.
    const applications: Application[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const page: HiringApplicationPage = await fetchHiringApplications(query);
      for (const application of page.applications) {
        if (!seen.has(application.id)) {
          seen.add(application.id);
          applications.push(application);
        }
      }
      const previousCursor: string | null = cursor;
      cursor = page.nextCursor;
      if (cursor && cursor === previousCursor) throw new Error('지원자 페이지 정보가 반복되었습니다.');
    } while (cursor);
    return applications;
  },

  async getApplicationsForJob(jobId: string, cursor?: string | null): Promise<HiringApplicationPage> {
    const query = new URLSearchParams({ jobId });
    if (cursor) query.set('cursor', cursor);
    return fetchHiringApplications(`?${query.toString()}`);
  },

  async getSentApplications(profileId: string): Promise<Application[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('applications')
      // 삭제된 공고 / 탈퇴한 공고 작성자 표시 X
      .select(`${APPLICANT_APPLICATION_COLUMNS}, job:jobs!inner(*), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .is('deleted_at', null)
      .is('job.deleted_at', null)
      .eq('applicant_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(redactAuthorNote);
  },

  async createApplication(input: {
    applicationId: string;
    jobId: string;
    resumeId: string;
    message: string;
    contactPhone?: string;
  }): Promise<Application> {
    // service_role 서버 라우트 경유 — 클라이언트 .insert().select().single() 의
    // RLS/트리거 hang 회피, 즉시 응답.
    const res = await apiFetch('/api/applications/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: input.applicationId,
        jobId: input.jobId,
        resumeId: input.resumeId,
        message: input.message,
        contactPhone: input.contactPhone,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || '접수에 실패했습니다.');
    }
    const { data } = await res.json();
    return redactAuthorNote(data);
  },

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    audience: ApplicationAudience = 'applicant',
  ): Promise<Application> {
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('set_application_status', {
      p_application_id: id,
      p_status: status,
    });
    if (rpcError) throw new Error(translateApplicationStatusError(rpcError.message));

    if (audience === 'hiring') return fetchHiringApplication(id);

    const { data, error: fetchError } = await supabase
      .from('applications')
      .select(`${APPLICANT_APPLICATION_COLUMNS}, job:jobs(*), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    return redactAuthorNote(data);
  },

  async markCompleted(id: string, audience: ApplicationAudience = 'applicant'): Promise<Application> {
    const supabase = createClient();
    const { error } = await supabase.rpc('mark_deal_completed', { p_application_id: id });
    if (error) throw error;
    if (audience === 'hiring') return fetchHiringApplication(id);

    const { data, error: fetchErr } = await supabase
      .from('applications')
      .select(`${APPLICANT_APPLICATION_COLUMNS}, job:jobs(*), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;
    return redactAuthorNote(data);
  },

  async setAuthorNote(id: string, note: string): Promise<Application> {
    const supabase = createClient();
    const { error } = await supabase.rpc('set_author_note', { p_application_id: id, p_note: note });
    if (error) throw error;
    return fetchHiringApplication(id);
  },
};
