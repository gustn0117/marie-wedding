import { createClient } from '@/lib/supabase/client';
import type { Booking, BookingStatus } from '@/types/database';

const ERROR_MAP: Record<string, string> = {
  unauthorized: '로그인이 필요합니다.',
  booking_not_found: '예약을 찾을 수 없습니다.',
  contract_not_found: '계약을 찾을 수 없습니다.',
  not_party_to_contract: '계약 당사자만 가능합니다.',
  not_party_to_booking: '예약 관계자만 가능합니다.',
  contract_not_signed: '서명 완료된 계약만 예약할 수 있습니다.',
  provider_must_be_party: '공급자는 계약 당사자여야 합니다.',
  booking_conflict: '같은 시간대에 다른 예약이 있습니다.',
  invalid_time_range: '종료 시간이 시작 시간보다 빠릅니다.',
};

function translateBookingError(message: string): string {
  for (const [code, kr] of Object.entries(ERROR_MAP)) {
    if (message.includes(code)) return kr;
  }
  if (message.includes('invalid_transition_from')) return '현재 상태에서 그 상태로 변경할 수 없습니다.';
  return message;
}

export interface MonthBookingRow {
  booking_id: string;
  contract_id: string;
  contract_title: string;
  counterpart_name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  status: BookingStatus;
  note: string | null;
}

export interface DayDigestRow {
  kind: 'booking' | 'contract_event' | 'availability';
  ref_id: string;
  start_time: string | null;
  end_time: string | null;
  label: string | null;
  status: string;
}

export interface ConflictRow {
  id: string;
  contract_id: string;
  start_time: string | null;
  end_time: string | null;
  status: BookingStatus;
  is_all_day: boolean;
}

export const bookingService = {
  async listByMonth(providerProfileId: string, from: string, to: string): Promise<MonthBookingRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_month_bookings', {
      p_provider_profile_id: providerProfileId,
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(translateBookingError(error.message));
    return (data ?? []) as MonthBookingRow[];
  },

  async getDayDigest(providerProfileId: string, date: string): Promise<DayDigestRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_day_digest', {
      p_provider_profile_id: providerProfileId,
      p_date: date,
    });
    if (error) throw new Error(translateBookingError(error.message));
    return (data ?? []) as DayDigestRow[];
  },

  async checkConflict(
    providerProfileId: string,
    eventDate: string,
    startTime: string | null = null,
    endTime: string | null = null,
    excludeBookingId: string | null = null,
  ): Promise<ConflictRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('check_booking_conflict', {
      p_provider_profile_id: providerProfileId,
      p_event_date: eventDate,
      p_start_time: startTime,
      p_end_time: endTime,
      p_exclude_booking_id: excludeBookingId,
    });
    if (error) throw new Error(translateBookingError(error.message));
    return (data ?? []) as ConflictRow[];
  },

  async create(input: {
    contractId: string;
    providerProfileId: string;
    eventDate: string;
    startTime?: string | null;
    endTime?: string | null;
    venue?: string | null;
    note?: string | null;
  }): Promise<Booking> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_booking_safe', {
      p_contract_id: input.contractId,
      p_provider_profile_id: input.providerProfileId,
      p_event_date: input.eventDate,
      p_start_time: input.startTime ?? null,
      p_end_time: input.endTime ?? null,
      p_note: input.note ?? null,
      p_venue: input.venue ?? null,
    });
    if (error) throw new Error(translateBookingError(error.message));
    return data as Booking;
  },

  async updateStatus(bookingId: string, nextStatus: BookingStatus, reason?: string): Promise<Booking> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_next_status: nextStatus,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(translateBookingError(error.message));
    return data as Booking;
  },

  async updateTime(bookingId: string, eventDate: string, startTime: string | null, endTime: string | null): Promise<Booking> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('update_booking_time', {
      p_booking_id: bookingId,
      p_event_date: eventDate,
      p_start_time: startTime,
      p_end_time: endTime,
    });
    if (error) throw new Error(translateBookingError(error.message));
    return data as Booking;
  },
};
