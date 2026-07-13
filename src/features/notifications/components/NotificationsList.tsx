'use client';

import { useState } from 'react';
import Link from 'next/link';
import { notificationService } from '@/features/notifications/services/notification-service';
import { formatRelativeTime } from '@/shared/utils/format';
import { withTimeout } from '@/shared/utils/withTimeout';
import type { Notification } from '@/types/database';

/**
 * 알림 목록 — 서버에서 불러온 initial 을 즉시 렌더한다.
 * (이전: 클라이언트에서 useAuth + getNotifications 로 매번 네트워크 왕복 → 로딩 오래.)
 * 읽음 처리(개별/전체)만 클라이언트 mutation 으로 처리한다.
 */
export default function NotificationsList({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState<Notification[]>(initial);

  const markRead = async (item: Notification) => {
    if (item.read_at) return;
    // 낙관적 업데이트 — 클릭 즉시 읽음 표시
    setItems((prev) => prev.map((row) => (
      row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row
    )));
    try {
      await withTimeout(notificationService.markRead(item.id), 8000, '읽음 처리 지연');
    } catch (err) {
      console.error('[notifications] markRead failed:', err);
    }
  };

  const markAllRead = async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((row) => ({ ...row, read_at: row.read_at ?? now })));
    try {
      await withTimeout(notificationService.markAllRead(), 8000, '모두 읽음 처리 지연');
    } catch (err) {
      console.error('[notifications] markAllRead failed:', err);
    }
  };

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
        {items.length === 0 ? (
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
