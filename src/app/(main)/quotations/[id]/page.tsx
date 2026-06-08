import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import QuotationDetailContent from '@/features/quotations/components/QuotationDetailContent';
import { ROUTES } from '@/shared/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: '견적 상세 | Marié' };

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
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

  return <QuotationDetailContent quotationId={params.id} profileId={profileId} />;
}
