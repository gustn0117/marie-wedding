'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

const DISMISSED_UNTIL_KEY = 'marie:launch-job-free-popup:dismissed-until';
const SESSION_DISMISSED_KEY = 'marie:launch-job-free-popup:session-dismissed';

function setSessionDismissed() {
  try {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, '1');
  } catch {
    // 저장소 접근이 제한된 환경에서도 닫기 동작 자체는 유지한다.
  }
}

export default function LaunchPromotionPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const sessionDismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY) === '1';
      const dismissedUntil = Number(localStorage.getItem(DISMISSED_UNTIL_KEY) ?? 0);
      const dismissedToday = Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();

      if (!sessionDismissed && !dismissedToday) setIsOpen(true);
    } catch {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSessionDismissed();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen]);

  const closeForSession = () => {
    setSessionDismissed();
    setIsOpen(false);
  };

  const dismissForToday = () => {
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);

    try {
      localStorage.setItem(DISMISSED_UNTIL_KEY, String(tomorrow.getTime()));
    } catch {
      // 저장 실패 시에도 현재 세션에서는 다시 열리지 않게 처리한다.
    }
    closeForSession();
  };

  if (!isOpen) return null;

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeForSession();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-promotion-title"
        aria-describedby="launch-promotion-description"
        className="animate-slideDown max-h-[calc(100dvh-1.5rem)] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-white/20 bg-white shadow-2xl"
      >
        <h2 id="launch-promotion-title" className="sr-only">
          마리에 런칭 기념 채용공고 무료 등록
        </h2>
        <p id="launch-promotion-description" className="sr-only">
          채용공고 등록비 0원 혜택을 안내하는 프로모션입니다.
        </p>

        <div className="relative overflow-hidden rounded-t-2xl">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeForSession}
            aria-label="팝업 닫기"
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md transition-colors hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <Link
            href={ROUTES.JOBS_NEW}
            onClick={closeForSession}
            aria-label="무료로 채용공고 등록하기"
            className="block"
          >
            <Image
              src="/images/popup-launch-free-job-v2.png"
              alt="마리에 런칭 기념, 채용공고 등록비 0원"
              width={1080}
              height={1080}
              priority
              sizes="(min-width: 640px) 520px, calc(100vw - 24px)"
              className="h-auto w-full"
            />
          </Link>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-[13px] sm:px-5">
          <button
            type="button"
            onClick={dismissForToday}
            className="font-semibold text-gray-500 transition-colors hover:text-primary"
          >
            오늘 하루 보지 않기
          </button>
          <button
            type="button"
            onClick={closeForSession}
            className="font-bold text-gray-700 transition-colors hover:text-primary"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
