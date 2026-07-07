import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import type { DirectoryFilters } from '../types';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';
import { REGION_DETAILS } from '@/shared/constants/regions';

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
      .eq('is_directory_listed', true)
      .order('company_name', { ascending: true });

    if (filters?.businessType) {
      const types = filters.businessType.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length > 0) {
        // CSV 컬럼이라 정확 매칭은 어렵고 ILIKE %type% 로 부분일치
        const orPart = types
          .map((t) => `business_type.ilike.%${normalizeSearchTerm(t)}%`)
          .filter((s) => !s.includes('ilike.%%'))
          .join(',');
        if (orPart) query = query.or(orPart);
      }
    }

    if (filters?.region) {
      const details = REGION_DETAILS[filters.region]?.map((d) => d.value) ?? [];
      query = query.in('region', [filters.region, ...details]);
    }

    if (filters?.search) {
      const term = normalizeSearchTerm(filters.search);
      if (term) {
        query = query.or(`company_name.ilike.%${term}%,contact_name.ilike.%${term}%`);
      }
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

  async updateProfile(id: string, updates: {
    contact_name?: string;
    company_name?: string | null;
    business_type?: string | null;
    region?: string;
    bio?: string | null;
    phone?: string | null;
    website?: string | null;
    profile_image?: string | null;
    company_size?: string | null;
    established_year?: string | null;
    address?: string | null;
    gallery?: string[] | null;
  }): Promise<Profile> {
    // service_role 서버 라우트 경유 — 클라이언트 .update().select().maybeSingle() 가
    // RLS readback / moderation trigger 영향으로 hang 또는 null 반환되는 케이스 우회.
    const res = await fetch('/api/directory/update', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: '' }));
      throw new Error(body.error || '프로필 저장에 실패했습니다.');
    }
    const { data } = await res.json();
    if (!data) throw new Error('프로필이 저장되었지만 응답이 비어 있어요.');
    return data as Profile;
  },

  async toggleDirectoryListing(id: string, listed: boolean): Promise<Profile> {
    // updateProfile 와 동일하게 service_role 서버 라우트 경유 (is_directory_listed 도 화이트리스트에 포함됨)
    const res = await fetch('/api/directory/update', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates: { is_directory_listed: listed } }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: '' }));
      throw new Error(body.error || `상태 변경에 실패했습니다 (HTTP ${res.status}).`);
    }
    const { data } = await res.json();
    if (!data) throw new Error('상태가 변경되었지만 응답이 비어 있어요.');
    return data as Profile;
  },
};
