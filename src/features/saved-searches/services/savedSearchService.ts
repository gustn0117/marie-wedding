'use client';

import { createClient } from '@/lib/supabase/client';
import type { SavedSearch, SavedSearchScope } from '@/types/database';

export const savedSearchService = {
  async list(profileId: string): Promise<SavedSearch[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SavedSearch[];
  },

  async create(input: {
    profileId: string;
    name: string;
    scope: SavedSearchScope;
    query: Record<string, unknown>;
  }): Promise<SavedSearch> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('saved_searches')
      .insert({
        profile_id: input.profileId,
        name: input.name,
        scope: input.scope,
        query: input.query,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as SavedSearch;
  },

  async remove(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').delete().eq('id', id);
    if (error) throw error;
  },
};

export function searchUrl(item: SavedSearch): string {
  const params = new URLSearchParams();
  Object.entries(item.query).forEach(([k, v]) => {
    if (v == null) return;
    if (Array.isArray(v)) params.set(k, v.join(','));
    else params.set(k, String(v));
  });
  const path = item.scope === 'jobs' ? '/jobs' : '/directory';
  return `${path}?${params.toString()}`;
}
