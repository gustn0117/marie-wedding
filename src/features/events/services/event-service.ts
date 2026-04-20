import { createClient } from '@/lib/supabase/client';
import type { Event } from '@/types/database';
import type { EventFormData } from '../types';

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
      const escaped = filters.search.replace(/[%_]/g, '\\$&');
      query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
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

  async createEvent(data: EventFormData): Promise<Event> {
    const supabase = createClient();
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        title: data.title,
        content: data.content,
        type: data.type,
        image: data.image || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        location: data.location || null,
        link_url: data.link_url || null,
        is_pinned: data.is_pinned,
      })
      .select()
      .single();
    if (error) throw error;
    return event as Event;
  },

  async updateEvent(id: string, data: Partial<EventFormData>): Promise<Event> {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) payload.title = data.title;
    if (data.content !== undefined) payload.content = data.content;
    if (data.type !== undefined) payload.type = data.type;
    if (data.image !== undefined) payload.image = data.image || null;
    if (data.start_date !== undefined) payload.start_date = data.start_date || null;
    if (data.end_date !== undefined) payload.end_date = data.end_date || null;
    if (data.location !== undefined) payload.location = data.location || null;
    if (data.link_url !== undefined) payload.link_url = data.link_url || null;
    if (data.is_pinned !== undefined) payload.is_pinned = data.is_pinned;

    const { data: event, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return event as Event;
  },

  async deleteEvent(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
