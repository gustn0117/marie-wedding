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
      .select('*, author:profiles!author_id(*)', { count: 'exact' })
      .is('deleted_at', null)
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
      .select('*, author:profiles!author_id(*)')
      .eq('id', id)
      .is('deleted_at', null)
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
  async createJob(formData: JobFormData, authorId: string): Promise<Job> {
    const supabase = createClient();

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('account_type, company_name, business_type, region, phone, bio')
      .eq('id', authorId)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile) throw new Error('프로필을 찾을 수 없습니다.');
    if (profile.account_type !== 'business') {
      throw new Error('공고 등록은 업체 회원만 가능합니다.');
    }

    const { checkBusinessProfileCompleteness } = await import('@/features/jobs/lib/business-profile-completeness');
    const check = checkBusinessProfileCompleteness(profile);
    if (!check.isComplete) {
      const missingLabels = check.missing.map((m) => m.label).join(', ');
      throw new Error(`업체 프로필을 먼저 완성해주세요. 부족한 항목: ${missingLabels}`);
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        author_id: authorId,
        posting_type: 'hiring',
        title: formData.title,
        description: formData.description,
        business_type: formData.businessType,
        employment_type: formData.employmentType,
        region: formData.region,
        salary_info: formData.salaryInfo || null,
        salary_min: formData.salaryMin ?? null,
        salary_max: formData.salaryMax ?? null,
        salary_unit: formData.salaryUnit ?? 'monthly',
        experience_min: formData.experienceMin ?? null,
        deadline: formData.deadline || null,
        image: formData.image || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`채용 공고 등록에 실패했습니다: ${error.message}`);
    }

    return data as Job;
  },

  /**
   * Update an existing job posting.
   */
  async updateJob(id: string, formData: Partial<JobFormData>): Promise<Job> {
    const supabase = createClient();

    const updateData: Record<string, unknown> = {};
    if (formData.title !== undefined) updateData.title = formData.title;
    if (formData.description !== undefined) updateData.description = formData.description;
    if (formData.businessType !== undefined) updateData.business_type = formData.businessType;
    if (formData.employmentType !== undefined) updateData.employment_type = formData.employmentType;
    if (formData.region !== undefined) updateData.region = formData.region;
    if (formData.salaryInfo !== undefined) updateData.salary_info = formData.salaryInfo || null;
    if (formData.salaryMin !== undefined) updateData.salary_min = formData.salaryMin;
    if (formData.salaryMax !== undefined) updateData.salary_max = formData.salaryMax;
    if (formData.salaryUnit !== undefined) updateData.salary_unit = formData.salaryUnit;
    if (formData.experienceMin !== undefined) updateData.experience_min = formData.experienceMin;
    if (formData.deadline !== undefined) updateData.deadline = formData.deadline || null;
    if (formData.image !== undefined) updateData.image = formData.image || null;

    const { data, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`채용 공고 수정에 실패했습니다: ${error.message}`);
    }

    return data as Job;
  },

  /**
   * Soft delete a job posting by setting deleted_at.
   */
  async deleteJob(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`채용 공고 삭제에 실패했습니다: ${error.message}`);
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
