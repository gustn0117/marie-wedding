import { createClient } from '@/lib/supabase/client';
import type { Job } from '@/types/database';
import type { JobFormData, JobFilters } from '../types';

const PAGE_SIZE_DEFAULT = 12;

export const jobService = {
  /**
   * Fetch jobs with optional filters and pagination.
   * Joins with profiles to get author info.
   * Orders by is_urgent DESC, created_at DESC.
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
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters?.postingType) {
      query = query.eq('posting_type', filters.postingType);
    }

    if (filters?.businessType) {
      query = query.eq('business_type', filters.businessType);
    }

    if (filters?.employmentType) {
      query = query.eq('employment_type', filters.employmentType);
    }

    if (filters?.region) {
      query = query.eq('region', filters.region);
    }

    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
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
   */
  async createJob(formData: JobFormData, authorId: string): Promise<Job> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        author_id: authorId,
        posting_type: formData.postingType || 'hiring',
        title: formData.title,
        description: formData.description,
        business_type: formData.businessType,
        employment_type: formData.employmentType,
        region: formData.region,
        salary_info: formData.salaryInfo || null,
        is_urgent: formData.isUrgent,
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
    if (formData.isUrgent !== undefined) updateData.is_urgent = formData.isUrgent;
    if (formData.deadline !== undefined) updateData.deadline = formData.deadline || null;

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
};
