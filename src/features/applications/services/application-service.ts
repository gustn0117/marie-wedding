import { createClient } from '@/lib/supabase/client';
import type { Application, ApplicationStatus } from '@/types/database';

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
      .select('*, job:jobs(*, author:profiles!author_id(*)), applicant:profiles(*)')
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
      .select('*, job:jobs!inner(*), applicant:profiles(*)')
      .is('deleted_at', null)
      .eq('job.author_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Application[];
  },

  async getSentApplications(profileId: string): Promise<Application[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('applications')
      .select('*, job:jobs(*), applicant:profiles(*)')
      .is('deleted_at', null)
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
    const supabase = createClient();
    const { data, error } = await supabase
      .from('applications')
      .insert({
        job_id: input.jobId,
        applicant_id: input.applicantId,
        message: input.message.trim(),
        contact_phone: input.contactPhone?.trim() || null,
      })
      .select('*, job:jobs(*), applicant:profiles(*)')
      .single();

    if (error) throw error;
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
      .select('*, job:jobs(*), applicant:profiles(*)')
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
      .select('*, job:jobs(*), applicant:profiles(*)')
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
      .select('*, job:jobs(*), applicant:profiles(*)')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;
    return data as Application;
  },
};
