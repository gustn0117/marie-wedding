import { redirect } from 'next/navigation';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES } from '@/shared/constants';
import type { Notification } from '@/types/database';
import NotificationsList from '@/features/notifications/components/NotificationsList';
import LoadErrorState from '@/shared/components/LoadErrorState';

export const dynamic = 'force-dynamic';

export const metadata = { title: '알림' };

export default async function NotificationsPage() {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(ROUTES.LOGIN);

  // 서버(내부 kong 직결)에서 즉시 조회 — 클라이언트 세션 토큰 대기·Cloudflare 왕복 없음.
  // 서버 클라이언트는 service_role 이라 RLS 를 우회하므로 profile_id 로 명시 필터.
  const supabase = createServerQueryClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', viewer.profileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  // 조회 실패를 "알림 없음"으로 오인시키지 않는다 — 명시적 에러 + 다시 시도.
  if (error) return <LoadErrorState message="알림을 불러오지 못했습니다." />;

  return <NotificationsList initial={(data ?? []) as Notification[]} />;
}
