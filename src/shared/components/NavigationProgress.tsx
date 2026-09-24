'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevUrl = useRef('');

  const start = useCallback(() => {
    // 이전 네비게이션의 지연된 '숨김' 타이머가 새 네비게이션 진행바를 끄지 않게 취소.
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    setVisible(true);
    setProgress(0);

    // Fast initial progress, then slow down
    let current = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      current += current < 50 ? 8 : current < 80 ? 3 : 0.5;
      if (current > 90) current = 90;
      setProgress(current);
    }, 100);
  }, []);

  const done = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      hideTimerRef.current = null;
    }, 200);
  }, []);

  useEffect(() => {
    const currentUrl = pathname + searchParams.toString();
    if (prevUrl.current && prevUrl.current !== currentUrl) {
      done();
    }
    prevUrl.current = currentUrl;
  }, [pathname, searchParams, done]);

  // Intercept link clicks to start progress bar
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
      if (anchor.getAttribute('target') === '_blank') return;

      const currentUrl = pathname + '?' + searchParams.toString();
      if (href !== currentUrl && href !== pathname) {
        start();
      }
    };

    // history.pushState 는 가로채지 않는다 — Next 는 이동이 끝난 뒤 useInsertionEffect 안에서
    // pushState 를 부르므로, 거기서 start() 하면 'useInsertionEffect must not schedule updates'
    // 에러가 나고 진행바도 끝난 뒤에 한 번 깜빡일 뿐이었다.
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
      if (timerRef.current) clearInterval(timerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [pathname, searchParams, start]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-toast h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          boxShadow: '0 0 12px rgba(5, 16, 73, 0.5), 0 0 4px rgba(5, 16, 73, 0.7)',
        }}
      />
    </div>
  );
}
