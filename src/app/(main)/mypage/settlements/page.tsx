import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SettlementsListContent from '@/features/settlements/components/SettlementsListContent';
import PageHeader from '@/shared/components/PageHeader';
import { ROUTES } from '@/shared/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: '정산 | Marié' };

export default async function SettlementsPage({ searchParams }: { searchParams: { status?: string } }) {
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
        title="정산"
        description="완료된 계약의 송금 내역을 확인합니다. 송금은 운영팀이 검토 후 처리합니다."
      />
      <SettlementsListContent profileId={profileId} initialStatus={searchParams.status} />
    </div>
  );
}
