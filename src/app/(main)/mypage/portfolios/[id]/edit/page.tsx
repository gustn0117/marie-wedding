import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import PortfolioForm from '@/features/portfolios/components/PortfolioForm';
import PageHeader from '@/shared/components/PageHeader';
import type { Portfolio } from '@/types/database';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function EditPortfolioPage({ params }: Props) {
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
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) notFound();
  const portfolio = data as Portfolio;
  if (portfolio.profile_id !== me.id) redirect('/mypage/portfolios');

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.MYPAGE} className="hover:text-primary">마이페이지</Link>
        <span className="mx-2 text-gray-300">›</span>
        <Link href="/mypage/portfolios" className="hover:text-primary">포트폴리오</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium">수정</span>
      </nav>

      <PageHeader eyebrow="포트폴리오" title="포트폴리오 수정" />

      <section className="surface p-6">
        <PortfolioForm profileId={me.id} initial={portfolio} />
      </section>
    </main>
  );
}
