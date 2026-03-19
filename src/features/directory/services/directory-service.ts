import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import type { DirectoryFilters } from '../types';

const DEFAULT_PAGE_SIZE = 12;

export const directoryService = {
  async getProfiles(
    filters?: DirectoryFilters,
    page: number = 1,
    pageSize: number = DEFAULT_PAGE_SIZE,
  ): Promise<{ data: Profile[]; count: number }> {
    const supabase = createClient();

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('company_name', { ascending: true });

    if (filters?.businessType) {
      query = query.eq('business_type', filters.businessType);
    }

    if (filters?.region) {
      query = query.eq('region', filters.region);
    }

    if (filters?.search) {
      query = query.or(
        `company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: (data as Profile[]) ?? [],
      count: count ?? 0,
    };
  },

  async getProfileById(id: string): Promise<Profile | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as Profile;
  },

  async getProfileByUserId(userId: string): Promise<Profile | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as Profile;
  },
};
