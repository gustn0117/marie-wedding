import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import QuotationCreateForm from '@/features/quotations/components/QuotationCreateForm';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

export const metadata = { title: '새 견적 작성 | Marié' };

export default async function NewQuotationPage({ searchParams }: { searchParams: { receiver?: string; conversation?: string } }) {
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
    <div className="max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="새 견적 작성"
        description="라인 항목별 단가와 수량을 입력하면 합계가 자동 계산됩니다 (VAT 10% 포함)."
      />
      <QuotationCreateForm
        senderProfileId={profileId}
        defaultReceiverId={searchParams.receiver}
        defaultConversationId={searchParams.conversation}
      />
    </div>
  );
}
