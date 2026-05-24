import { createClient } from '@/lib/supabase/client';
import type { Application, ApplicationStatus } from '@/types/database';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: '접수',
  reviewing: '검토 중',
  accepted: '승인',
  rejected: '거절',
  cancelled: '취소',
};

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
    const { data, error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', id)
      .select('*, job:jobs(*), applicant:profiles(*)')
      .single();

    if (error) throw error;
    return data as Application;
  },
};
