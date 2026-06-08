import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import QuotationsListContent from '@/features/quotations/components/QuotationsListContent';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

export const metadata = { title: '견적 | Marié' };

export default async function QuotationsPage({ searchParams }: { searchParams: { tab?: string; status?: string } }) {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile')?.value;
  if (!profileCookie) redirect(ROUTES.LOGIN);

  let profileId: string;
  try {
    profileId = JSON.parse(profileCookie).id;
    if (!profileId) throw new Error();
  } catch {
    redirect(ROUTES.LOGIN);
  }

  const direction = (searchParams.tab === 'sent' || searchParams.tab === 'received') ? searchParams.tab : 'received';
  const status = searchParams.status;

  return (
    <div className="space-y-4">
      <PageHeader
        title="견적"
        description="업체 간 거래의 시작 — 받은 견적과 보낸 견적을 한곳에서 관리합니다."
        actions={
          <Link href={ROUTES.QUOTATIONS_NEW} className="btn-primary text-sm">+ 새 견적 작성</Link>
        }
      />
      <QuotationsListContent profileId={profileId} initialDirection={direction} initialStatus={status} />
    </div>
  );
}
