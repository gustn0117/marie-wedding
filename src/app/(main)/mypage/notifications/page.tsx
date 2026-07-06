'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/shared/hooks/useAuth';
import { notificationService } from '@/features/notifications/services/notification-service';
import { formatRelativeTime } from '@/shared/utils/format';
import type { Notification } from '@/types/database';
import { withTimeout } from '@/shared/utils/withTimeout';

export default function NotificationsPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    withTimeout(notificationService.getNotifications(), 10000, '알림 조회 지연')
      .then(setItems)
      .catch((err) => { console.error(err); })
      .finally(() => setLoading(false));
  }, [isAuthenticated, isLoading]);

  const markRead = async (item: Notification) => {
    if (item.read_at) return;
    await notificationService.markRead(item.id);
    setItems((prev) => prev.map((row) => (
      row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row
    )));
  };

  const markAllRead = async () => {
    await notificationService.markAllRead();
    const now = new Date().toISOString();
    setItems((prev) => prev.map((row) => ({ ...row, read_at: row.read_at ?? now })));
  };

  if (isLoading) {
    return <div className="mx-auto max-w-[860px] animate-pulse rounded border border-gray-200 bg-white p-8 h-48" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="mb-3 text-xl font-bold text-gray-900">로그인이 필요합니다</h1>
        <Link href={ROUTES.LOGIN} className="btn-primary">로그인하기</Link>
      </div>
    );
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="mx-auto max-w-[860px] space-y-4">
      <section className="saramin-section p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-primary">Notifications</p>
          <h1 className="text-2xl font-bold text-gray-900">알림</h1>
          <p className="mt-1 text-sm text-gray-500">읽지 않은 알림 {unread}개</p>
        </div>
        {unread > 0 && (
          <button type="button" onClick={markAllRead} className="btn-outline text-sm">모두 읽음</button>
        )}
      </section>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">알림을 불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">아직 알림이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const content = (
                <article
                  className={`px-5 py-4 transition-colors ${item.read_at ? 'bg-white' : 'bg-primary-50/40'}`}
                  onClick={() => markRead(item)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2 w-2 rounded-full ${item.read_at ? 'bg-gray-200' : 'bg-primary'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-gray-900">{item.title}</h2>
                        <time className="text-xs text-gray-400">{formatRelativeTime(item.created_at)}</time>
                      </div>
                      {item.message && <p className="mt-1 text-sm text-gray-600">{item.message}</p>}
                    </div>
                  </div>
                </article>
              );

              return item.link_url ? (
                <Link key={item.id} href={item.link_url}>{content}</Link>
              ) : (
                <div key={item.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
