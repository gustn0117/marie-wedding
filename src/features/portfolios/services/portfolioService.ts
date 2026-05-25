'use client';

import { createClient } from '@/lib/supabase/client';
import type { Portfolio } from '@/types/database';

const BUCKET = 'portfolios';

export const portfolioService = {
  async list(profileId: string): Promise<Portfolio[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .order('is_featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Portfolio[];
  },

  async get(id: string): Promise<Portfolio | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data as Portfolio | null;
  },

  async create(input: Omit<Portfolio, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Portfolio> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('portfolios')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data as Portfolio;
  },

  async update(id: string, input: Partial<Omit<Portfolio, 'id' | 'profile_id' | 'created_at' | 'updated_at'>>): Promise<Portfolio> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('portfolios')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as Portfolio;
  },

  async softDelete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('portfolios')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async uploadImage(profileId: string, portfolioId: string, file: File): Promise<string> {
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${profileId}/${portfolioId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw error;
    return path;
  },

  publicUrl(path: string): string {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  },
};
