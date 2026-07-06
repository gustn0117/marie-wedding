import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import MyPageRail from '@/features/mypage/components/MyPageRail';

/**
 * mypage 워크스페이스 셸 — 좌측 rail + 우측 본문 (lg 이상).
 * 서버에서 marie_profile 쿠키를 읽어 MyPageRail 에 `initialAccountType` prop 주입 →
 * SSR/첫 hydration 부터 업체/개인 메뉴가 확정된 상태로 렌더 (CLS 방지).
 */
export default async function MyPageLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  let initialAccountType: 'business' | 'individual' | null = null;
  try {
    const raw = cookieStore.get('marie_profile')?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      const at = parsed?.account_type;
      if (at === 'business' || at === 'individual') initialAccountType = at;
    }
  } catch {}

  return (
    <div className="lg:grid lg:grid-cols-[var(--rail-w)_1fr] lg:gap-8">
      <MyPageRail initialAccountType={initialAccountType} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
