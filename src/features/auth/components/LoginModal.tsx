'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LOGIN_DIALOG_TITLE_ID } from './LoginForm';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 사이트 안에서 /login 으로 이동하면(@modal/(.)login 가로채기 라우트) 보던 화면 위에 뜨는 로그인 창.
 * md 이상: 가운데 창 + 어두운 배경 / md 미만: 전체 화면(로그인 페이지와 같은 모습).
 * 닫기(X·배경·ESC)는 뒤로가기 — 주소가 /login 에서 보던 페이지로 돌아간다.
 * 새로고침·직접 접속은 가로채지 않으므로 (auth)/login 페이지가 그대로 뜬다.
 */
export default function LoginModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => router.back(), [router]);

  // body scroll lock (iOS 호환) — 스크롤바가 사라지며 본문이 옆으로 밀리지 않게 폭만큼 채운다.
  useEffect(() => {
    const y = window.scrollY;
    const body = document.body;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      body.style.paddingRight = '';
      window.scrollTo({ top: y, behavior: 'instant' });
    };
  }, []);

  // ESC 닫기 + 포커스를 창 안에 가둔다. 닫히면 창을 연 버튼으로 포커스를 돌려준다.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!panel.contains(current)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-modal flex overflow-y-auto overscroll-contain bg-white md:bg-black/60 md:p-6"
      // 배경을 눌렀다 뗄 때만 닫는다 — 입력칸에서 드래그하다 배경에서 놓아도 닫히지 않게 mousedown 기준.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={LOGIN_DIALOG_TITLE_ID}
        className="relative w-full bg-white md:m-auto md:max-w-[480px] md:rounded-2xl md:shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="로그인 창 닫기"
          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
