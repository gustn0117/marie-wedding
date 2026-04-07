'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevUrl = useRef('');

  const start = useCallback(() => {
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
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
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

    // Also intercept router.push via history
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    history.pushState = function (...args) {
      start();
      return origPushState(...args);
    };

    history.replaceState = function (...args) {
      return origReplaceState(...args);
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pathname, searchParams, start]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px]">
      <div
        className="h-full bg-primary transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
