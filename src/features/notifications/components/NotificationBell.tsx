'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatRelativeTime } from '@/shared/utils/format';
import { withTimeout } from '@/shared/utils/withTimeout';
import { apiFetch } from '@/shared/utils/apiFetch';
import { ROUTES } from '@/shared/constants';
import { notificationService } from '@/features/notifications/services/notification-service';

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
  message: '쪽지',
  system: '시스템',
};

// DB 트리거가 만드는 실제 타입은 message_received·deal_half_completed 처럼 접두사형이
// 많다. 정확 매칭이 없으면 첫 글자('m','d')가 배지에 뜨던 것을 패밀리 매핑 + '알림' 폴백으로 바꾼다.
function labelForType(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  if (type.startsWith('message')) return '쪽지';
  if (type.startsWith('deal') || type.startsWith('contract') || type.startsWith('booking') || type.startsWith('settlement')) return '거래';
  if (type.startsWith('application') || type.startsWith('apply')) return '지원';
  if (type.startsWith('review')) return '리뷰';
  if (type.startsWith('payment') || type.startsWith('premium') || type.startsWith('quotation')) return '결제';
  if (type.startsWith('job')) return '공고';
  return '알림';
}
function toneForType(type: string): string {
  if (TYPE_TONES[type]) return TYPE_TONES[type];
  if (type.startsWith('message')) return TYPE_TONES.message;
  if (type.startsWith('payment') || type.startsWith('premium') || type.startsWith('quotation')) return TYPE_TONES.payment;
  if (type.startsWith('review')) return TYPE_TONES.review;
  if (type.startsWith('application') || type.startsWith('apply') || type.startsWith('job') || type.startsWith('deal')) return TYPE_TONES.application;
  return TYPE_TONES.system;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 서버 라우트(service_role)로 목록+안읽음수 동시 조회 — 마이페이지 알림과 동일 소스.
  // 클라이언트 supabase 의 RLS/세션토큰 대기로 인한 빈결과·hang 회피.
  const loadData = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const res = await apiFetch('/api/notifications/list', { credentials: 'include' }, 8000);
      if (res.ok) {
        const body = await res.json();
        setItems((body.items ?? []) as Notification[]);
        setUnreadCount(body.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('[NotificationBell] loadData failed:', err);
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, []);

  // 마운트 시 + 60초마다 안읽음수 갱신. 단, 탭이 백그라운드일 땐 폴링을 멈춘다.
  // 폴링 1회 = 공유 GoTrue getUser() 검증 + DB 조회라, 열어만 둔 수많은 배경 탭이
  // 접속자 수에 비례해 상시 인증 부하를 만들던 것을 없앤다. 탭 복귀 시 즉시 1회 갱신.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (timer === null) timer = setInterval(() => loadData(), 60_000); };
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { loadData(); start(); }
      else stop();
    };
    if (document.visibilityState === 'visible') { loadData(); start(); }
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [loadData]);

  // 열 때 fresh load (스피너 표시)
  useEffect(() => {
    if (open) loadData(true);
  }, [open, loadData]);

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
    // UI는 즉시 반영 (낙관적). 서버 update가 hang해도 UX 영향 없음.
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await withTimeout(notificationService.markAllRead(), 8000, '읽음 처리 지연');
    } catch {
      // 무시 — 낙관적 UI는 유지
    }
  };

  const handleItemClick = async (item: Notification) => {
    setOpen(false); // 클릭 즉시 닫기
    if (!item.read_at) {
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await withTimeout(notificationService.markRead(item.id), 5000, '읽음 처리 지연');
      } catch {
        // 무시 — 다음 진입 시 반영됨
      }
    }
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
          // 모바일: 뷰포트에 고정(fixed)해 화면 밖으로 잘리지 않게. sm↑: 벨 기준 우측 정렬 드롭다운.
          className="fixed left-2 right-2 top-[calc(var(--header-h)+8px)] w-auto max-w-none sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] sm:max-w-[calc(100vw-32px)] rounded-xl border border-gray-200 bg-white shadow-xl z-50"
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
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold shrink-0 ${toneForType(n.type)}`}>
                        {labelForType(n.type)}
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
