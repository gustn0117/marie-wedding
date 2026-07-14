import type { ReactNode } from 'react';
import MyPageRail from '@/features/mypage/components/MyPageRail';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';

/**
 * mypage 워크스페이스 셸 — 좌측 rail + 우측 본문 (lg 이상).
 * 검증된 세션에서 계정 유형을 읽어 SSR/첫 hydration부터 메뉴를 확정한다.
 */
export default async function MyPageLayout({ children }: { children: ReactNode }) {
  const viewer = await getCurrentVerifiedProfile();
  const initialAccountType = viewer.ok ? viewer.accountType : null;

  return (
    <div className="lg:grid lg:grid-cols-[var(--rail-w)_1fr] lg:gap-8">
      <MyPageRail initialAccountType={initialAccountType} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
