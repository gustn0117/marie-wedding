import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/types/database';

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return (data ?? []) as Notification[];
  },

  // 읽음 처리는 서버 라우트(service_role)로 — 클라 update 는 세션 토큰 지연/RLS 로
  // 실패해 read_at 이 저장 안 되고 안읽음 배지가 안 줄던 문제를 회피.
  async markRead(id: string): Promise<void> {
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error('읽음 처리에 실패했습니다.');
  },

  async markAllRead(): Promise<void> {
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) throw new Error('읽음 처리에 실패했습니다.');
  },
};
