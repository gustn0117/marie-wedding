import { apiFetch } from '@/shared/utils/apiFetch';
import { createClient } from '@/lib/supabase/client';
import type { Job } from '@/types/database';
import type { JobFormData, JobFilters } from '../types';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';
import { REGION_DETAILS } from '@/shared/constants/regions';

const PAGE_SIZE_DEFAULT = 12;

export const jobService = {
  /**
   * Fetch jobs with optional filters and pagination.
   * Joins with profiles to get author info.
   * Orders by created_at DESC.
   */
  async getJobs(
    filters?: JobFilters,
    page: number = 1,
    pageSize: number = PAGE_SIZE_DEFAULT
  ): Promise<{ data: Job[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('jobs')
      // author.deleted_at IS NULL — 탈퇴 업체 공고 은닉
      .select('*, author:profiles!author_id!inner(*)', { count: 'exact' })
      .is('deleted_at', null)
      .is('author.deleted_at', null)
      .eq('posting_type', 'hiring')
      .order('is_promoted', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters?.businessType) {
      const types = filters.businessType.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length > 0) query = query.in('business_type', types);
    }

    if (filters?.employmentType) {
      query = query.eq('employment_type', filters.employmentType);
    }

    if (filters?.region) {
      const details = REGION_DETAILS[filters.region]?.map((d) => d.value) ?? [];
      query = query.in('region', [filters.region, ...details]);
    }

    if (filters?.search) {
      const term = normalizeSearchTerm(filters.search);
      if (term) query = query.ilike('title', `%${term}%`);
    }

    if (filters?.authorId) {
      query = query.eq('author_id', filters.authorId);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`채용 공고를 불러오는 데 실패했습니다: ${error.message}`);
    }

    return {
      data: (data as Job[]) ?? [],
      count: count ?? 0,
    };
  },

  /**
   * Fetch a single job by ID with author profile.
   */
  async getJobById(id: string): Promise<Job | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('jobs')
      // author.deleted_at IS NULL — 탈퇴 업체의 공고 상세도 은닉
      .select('*, author:profiles!author_id!inner(*)')
      .eq('id', id)
      .is('deleted_at', null)
      .is('author.deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`채용 공고를 불러오는 데 실패했습니다: ${error.message}`);
    }

    return data as Job;
  },

  /**
   * Create a new job posting.
   *
   * INSERT 전 본인 업체 프로필의 핵심 필드(업체명/업종/지역/연락처/소개)가 채워져 있는지 검증한다.
   * 클라이언트 측 가드는 우회 가능하므로 service 레이어에서 한 번 더 본다.
   */
  /**
   * Create a new job posting — service_role 서버 라우트 경유.
   * QA-010 재발 방지 (auto_moderate + protect_job_admin_cols 트리거 우회).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createJob(formData: JobFormData, _authorId: string): Promise<Job> {
    const res = await apiFetch('/api/jobs/write', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'create', payload: formData }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: '' }));
      throw new Error(body.error || `등록에 실패했습니다 (HTTP ${res.status}).`);
    }
    const { job } = await res.json();
    return job as Job;
  },

  /**
   * Update an existing job posting — service_role 서버 라우트 경유.
   */
  async updateJob(id: string, formData: Partial<JobFormData>): Promise<Job> {
    const res = await apiFetch('/api/jobs/write', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'update', id, payload: formData }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: '' }));
      throw new Error(body.error || `수정에 실패했습니다 (HTTP ${res.status}).`);
    }
    const { job } = await res.json();
    return job as Job;
  },

  /**
   * Soft delete a job posting.
   * 클라이언트 측 UPDATE가 RLS WITH CHECK에서 막히는 케이스를 우회하기 위해 server route 경유.
   */
  async deleteJob(id: string): Promise<void> {
    const res = await apiFetch(`/api/jobs/${id}/delete`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: '' }));
      throw new Error(body.error || `채용 공고 삭제에 실패했습니다 (HTTP ${res.status}).`);
    }
  },

  /**
   * Update job status (open/closed/filled/hidden). RLS restricts to author/admin.
   */
  async updateStatus(id: string, status: 'open' | 'closed' | 'filled' | 'hidden'): Promise<Job> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`상태 변경 실패: ${error.message}`);
    return data as Job;
  },
};
