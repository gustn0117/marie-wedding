import type { ReactNode } from 'react';
import MyPageRail from '@/features/mypage/components/MyPageRail';

/**
 * mypage 워크스페이스 셸 — 좌측 rail + 우측 본문 (lg 이상).
 * 모바일에선 rail이 가로 스크롤 칩으로 전환.
 */
export default function MyPageLayout({ children }: { children: ReactNode }) {
  // (main) layout이 .shell-wide로 폭·패딩 처리. 여기선 grid만.
  return (
    <div className="lg:grid lg:grid-cols-[var(--rail-w)_1fr] lg:gap-8">
      <MyPageRail />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
