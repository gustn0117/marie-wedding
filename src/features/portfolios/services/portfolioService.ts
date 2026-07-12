'use client';

import { apiFetch } from '@/shared/utils/apiFetch';

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

  // ── mutations 는 service_role 서버 라우트 경유. RLS/trigger readback 이슈 사전 봉인. ──

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(input: Omit<Portfolio, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Portfolio> {
    const res = await apiFetch('/api/portfolios/write', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'create', payload: input }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || `등록 실패 (HTTP ${res.status}).`);
    }
    return (await res.json()).portfolio as Portfolio;
  },

  async update(id: string, input: Partial<Omit<Portfolio, 'id' | 'profile_id' | 'created_at' | 'updated_at'>>): Promise<Portfolio> {
    const res = await apiFetch('/api/portfolios/write', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'update', id, payload: input }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || `수정 실패 (HTTP ${res.status}).`);
    }
    return (await res.json()).portfolio as Portfolio;
  },

  async softDelete(id: string): Promise<void> {
    const res = await apiFetch('/api/portfolios/delete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || `삭제 실패 (HTTP ${res.status}).`);
    }
  },

  async uploadImage(profileId: string, portfolioId: string, file: File): Promise<string> {
    // Storage 업로드는 RLS 우회 필요 없음 (사용자 본인 경로) — client 유지
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
};
