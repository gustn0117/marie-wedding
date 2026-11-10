import type { ReactNode } from 'react';

export const metadata = {
  title: '시작하기',
  description: '간단한 정보를 입력하면 맞춤 공고를 보여드립니다.',
};

/**
 * Onboarding은 route group `(main)` 밖에 있어 Header/Footer 없는 깨끗한 layout을 사용.
 * Referrer-Policy: no-referrer로 OAuth 콜백 직후 fragment 누출 방지.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <meta name="referrer" content="no-referrer" />
      {/* 앱에서는 상태 표시줄 자리를 비운다(.app-safe-top) */}
      <main className="app-safe-top min-h-screen bg-background">{children}</main>
    </>
  );
}
