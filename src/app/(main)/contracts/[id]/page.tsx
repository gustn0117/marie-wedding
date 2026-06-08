import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ContractDetailContent from '@/features/contracts/components/ContractDetailContent';
import { ROUTES } from '@/shared/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: '계약 상세 | Marié' };

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
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

  if (!params.id) notFound();

  return <ContractDetailContent contractId={params.id} profileId={profileId} />;
}
