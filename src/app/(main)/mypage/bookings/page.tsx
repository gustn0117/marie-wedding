import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import BookingCalendarContent from '@/features/bookings/components/BookingCalendarContent';
import PageHeader from '@/shared/components/PageHeader';
import { ROUTES } from '@/shared/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: '예약·일정 | Marié' };

export default async function BookingsPage() {
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
        title="예약·일정"
        description="계약이 확정된 예식 일정을 캘린더로 한 눈에 관리합니다."
      />
      <BookingCalendarContent profileId={profileId} />
    </div>
  );
}
