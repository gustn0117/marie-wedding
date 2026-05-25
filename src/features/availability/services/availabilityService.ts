'use client';

import { createClient } from '@/lib/supabase/client';
import type { AvailabilitySlot, AvailabilityStatus } from '@/types/database';

export const availabilityService = {
  async listForProfile(profileId: string, fromIso: string, toIso: string, options?: { publicOnly?: boolean }): Promise<AvailabilitySlot[]> {
    const supabase = createClient();
    if (options?.publicOnly) {
      const { data, error } = await supabase.rpc('get_public_availability', {
        p_profile_id: profileId,
        p_from: fromIso,
        p_to: toIso,
      });
      if (error) throw error;
      return ((data ?? []) as Array<Pick<AvailabilitySlot, 'id' | 'profile_id' | 'date' | 'status'>>).map((r) => ({
        ...r,
        note: null,
        created_at: '',
        updated_at: '',
      })) as AvailabilitySlot[];
    }
    const { data, error } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('profile_id', profileId)
      .gte('date', fromIso)
      .lte('date', toIso)
      .order('date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AvailabilitySlot[];
  },

  async upsert(input: { profileId: string; date: string; status: AvailabilityStatus; note?: string | null }): Promise<AvailabilitySlot> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('availability_slots')
      .upsert(
        { profile_id: input.profileId, date: input.date, status: input.status, note: input.note ?? null },
        { onConflict: 'profile_id,date' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as AvailabilitySlot;
  },

  async remove(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('availability_slots').delete().eq('id', id);
    if (error) throw error;
  },
};

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return { from: ymd(from), to: ymd(to) };
}
