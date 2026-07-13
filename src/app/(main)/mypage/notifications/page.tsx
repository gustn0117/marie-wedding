import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import type { Notification } from '@/types/database';
import NotificationsList from '@/features/notifications/components/NotificationsList';

export const dynamic = 'force-dynamic';

export const metadata = { title: '알림 | Marié' };

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  // 서버(내부 kong 직결)에서 즉시 조회 — 클라이언트 세션 토큰 대기·Cloudflare 왕복 없음.
  // 서버 클라이언트는 service_role 이라 RLS 를 우회하므로 profile_id 로 명시 필터.
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', me.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return <NotificationsList initial={(data ?? []) as Notification[]} />;
}
