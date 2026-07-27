'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * 방문 기록 전송 — 경로가 바뀔 때마다 한 번씩만 보낸다.
 *
 * 화면 렌더를 막지 않도록 keepalive fetch 로 던지고 응답은 기다리지 않는다.
 * 실패해도 무시한다(측정이 서비스보다 중요할 수 없다).
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    // 관리자 화면은 사장님 본인 동선이라 유입 통계를 왜곡한다.
    if (!pathname || pathname.startsWith('/admin')) return;

    const qs = search?.toString();
    const full = qs ? `${pathname}?${qs}` : pathname;
    if (lastSent.current === full) return;
    lastSent.current = full;

    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: full, referrer: document.referrer || '' }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* noop */ }
  }, [pathname, search]);

  return null;
}
