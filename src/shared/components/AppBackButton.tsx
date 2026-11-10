'use client';

import { useRouter } from 'next/navigation';
import { markAppBackNavigation } from '@/shared/utils/appShell';

/**
 * 앱 전용 뒤로 버튼 — 브라우저에는 뒤로 버튼이 있지만 앱 화면에는 없어서 둔다(.app-only: 브라우저에선 숨김).
 * 앱을 바로 이 화면으로 열어 돌아갈 곳이 없으면 홈으로 간다.
 * 돌아간 화면은 왼쪽에서 들어온다(AppTouchFeedback).
 */
export default function AppBackButton({ className = '' }: { className?: string }) {
  const router = useRouter();

  const goBack = () => {
    markAppBackNavigation();
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="뒤로"
      className={`app-only inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink ${className}`}
    >
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
      </svg>
    </button>
  );
}
