import { createClient } from '@/lib/supabase/client';
import type { Event } from '@/types/database';
import type { EventFormData } from '../types';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';

export const eventService = {
  async getEvents(
    filters?: { type?: string; search?: string },
    page: number = 1,
    pageSize: number = 12,
  ): Promise<{ data: Event[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.search) {
      const term = normalizeSearchTerm(filters.search);
      if (term) {
        query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
      }
    }

    query = query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: (data ?? []) as Event[], count: count ?? 0 };
  },

  async getEventById(id: string): Promise<Event | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error) return null;
    return data as Event;
  },

  // ── mutations: 관리자 전용 service_role 서버 라우트 ──

  async createEvent(data: EventFormData): Promise<Event> {
    const res = await fetch('/api/events/write', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'create', payload: data }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || `등록 실패 (HTTP ${res.status}).`);
    }
    return (await res.json()).event as Event;
  },

  async updateEvent(id: string, data: Partial<EventFormData>): Promise<Event> {
    const res = await fetch('/api/events/write', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'update', id, payload: data }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || `수정 실패 (HTTP ${res.status}).`);
    }
    return (await res.json()).event as Event;
  },

  async deleteEvent(id: string): Promise<void> {
    const res = await fetch('/api/events/write', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'delete', id }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || `삭제 실패 (HTTP ${res.status}).`);
    }
  },
};
