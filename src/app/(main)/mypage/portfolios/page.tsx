import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';
import PortfolioCard from '@/features/portfolios/components/PortfolioCard';
import type { Portfolio } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function MyPortfoliosPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('portfolios')
    .select('*')
    .eq('profile_id', me.id)
    .is('deleted_at', null)
    .order('is_featured', { ascending: false })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  const portfolios = (data ?? []) as Portfolio[];

  return (
    <main className="mx-auto max-w-[1200px] space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.MYPAGE} className="hover:text-primary">마이페이지</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium">포트폴리오</span>
      </nav>

      <PageHeader
        eyebrow="포트폴리오"
        title="내 포트폴리오"
        description="작품 단위로 진행 기록·이미지·예식장을 정리해 디렉토리에 노출됩니다."
        actions={
          <Link href="/mypage/portfolios/new" className="btn-primary text-sm">
            + 새 포트폴리오
          </Link>
        }
      />

      {portfolios.length === 0 ? (
        <section className="platform-panel p-10 text-center">
          <p className="text-sm text-gray-500">등록된 포트폴리오가 없습니다. 첫 작품을 등록해 보세요.</p>
        </section>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {portfolios.map((p) => (
            <PortfolioCard key={p.id} portfolio={p} showEdit />
          ))}
        </section>
      )}
    </main>
  );
}
