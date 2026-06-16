'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeTime } from '@/shared/utils/format';
import { ROUTES } from '@/shared/constants';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_TONES: Record<string, string> = {
  application: 'bg-blue-50 text-blue-700',
  job: 'bg-primary-50 text-primary',
  review: 'bg-amber-50 text-amber-700',
  payment: 'bg-emerald-50 text-emerald-700',
  message: 'bg-gray-100 text-gray-700',
  system: 'bg-gray-100 text-gray-700',
};

const TYPE_LABELS: Record<string, string> = {
  application: '지원',
  job: '공고',
  review: '리뷰',
  payment: '결제',
  message: '메시지',
  system: '시스템',
};

export default function NotificationBell({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    const sb = createClient();
    const { count } = await sb
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .is('read_at', null)
      .is('deleted_at', null);
    setUnreadCount(count ?? 0);
  }, [profileId]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb
      .from('notifications')
      .select('id, type, title, message, link_url, read_at, created_at')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 60_000);
    return () => clearInterval(t);
  }, [loadCount]);

  // 열 때 fresh load
  useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  // outside click + esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleMarkAllRead = async () => {
    const sb = createClient();
    await sb
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', profileId)
      .is('read_at', null);
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnreadCount(0);
  };

  const handleItemClick = async (item: Notification) => {
    if (!item.read_at) {
      const sb = createClient();
      await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`알림 ${unreadCount > 0 ? `${unreadCount}개 새로 도착` : '없음'}`}
        aria-expanded={open}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-600 hover:bg-gray-100 hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="알림"
          className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-32px)] rounded-xl border border-gray-200 bg-white shadow-xl z-50"
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-ink">알림</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs text-gray-500 hover:text-ink font-bold">
                모두 읽음
              </button>
            )}
          </header>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">알림이 없습니다</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((n) => {
                  const isUnread = !n.read_at;
                  const Inner = (
                    <div className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${isUnread ? 'bg-blue-50/40' : ''}`}>
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold shrink-0 ${TYPE_TONES[n.type] ?? TYPE_TONES.system}`}>
                        {TYPE_LABELS[n.type] ?? n.type[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${isUnread ? 'font-bold text-ink' : 'text-gray-700'}`}>{n.title}</p>
                        {n.message && <p className="text-xs text-gray-500 truncate mt-0.5">{n.message}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">{formatRelativeTime(n.created_at)}</p>
                      </div>
                      {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" aria-label="안 읽음" />}
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link_url ? (
                        <Link href={n.link_url} onClick={() => handleItemClick(n)} className="block">
                          {Inner}
                        </Link>
                      ) : (
                        <button type="button" onClick={() => handleItemClick(n)} className="block w-full text-left">
                          {Inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <Link
              href={ROUTES.MYPAGE_NOTIFICATIONS}
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-bold text-gray-600 hover:text-ink"
            >
              알림 전체 보기 →
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}
