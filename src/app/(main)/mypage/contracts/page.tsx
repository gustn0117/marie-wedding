import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ContractsListContent from '@/features/contracts/components/ContractsListContent';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

export const metadata = { title: '계약 | Marié' };

export default async function ContractsPage({ searchParams }: { searchParams: { status?: string; side?: string } }) {
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="계약"
        description="견적 승인 후 양방 서명·진행·완료까지 계약 흐름을 관리합니다."
      />
      <ContractsListContent profileId={profileId} initialStatus={searchParams.status} initialSide={searchParams.side} />
    </div>
  );
}
