import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import PortfolioForm from '@/features/portfolios/components/PortfolioForm';

export const dynamic = 'force-dynamic';

export default async function NewPortfolioPage() {
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
        <Link href="/mypage/portfolios" className="hover:text-primary">포트폴리오</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium">새 작품</span>
      </nav>

      <header className="platform-panel p-6">
        <p className="platform-eyebrow">포트폴리오</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">새 포트폴리오 등록</h1>
      </header>

      <section className="platform-panel p-6">
        <PortfolioForm profileId={me.id} />
      </section>
    </main>
  );
}
