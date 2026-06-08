import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import AvailabilityCalendar from '@/features/availability/components/AvailabilityCalendar';

export const dynamic = 'force-dynamic';

export default async function MyAvailabilityPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.MYPAGE} className="hover:text-primary">마이페이지</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium">가용 일정</span>
      </nav>

      <header className="platform-panel p-6">
        <p className="platform-eyebrow">일정</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">가용 일정 관리</h1>
        <p className="mt-2 text-sm text-gray-600">
          예식 날짜별로 가능/불가를 표시해 두면 디렉토리 상세에서 다른 사용자가 확인할 수 있습니다.
        </p>
      </header>

      <section className="platform-panel p-6">
        <AvailabilityCalendar profileId={me.id} editable />
      </section>
    </main>
  );
}
