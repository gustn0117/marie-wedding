'use client';

import { useCallback, useEffect, useRef } from 'react';
import { LOGIN_DIALOG_TITLE_ID } from './LoginForm';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 보던 화면 위에 뜨는 로그인 창의 틀(LoginModalHost 가 연다).
 * 가운데 창 + 어두운 배경. 좁은 폭에서는 전체 화면으로 채운다.
 * 닫기: X · 배경 클릭 · ESC. 스크롤 잠금·위치 복원, 포커스 가두기·복귀.
 */
export default function LoginModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  // 호출부가 매 렌더 새 함수를 넘겨도 키보드·포커스 effect 가 다시 돌지 않게 ref 로 고정한다.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const close = useCallback(() => onCloseRef.current(), []);

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
