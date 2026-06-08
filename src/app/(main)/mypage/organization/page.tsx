import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import OrganizationManager from '@/features/organizations/components/OrganizationManager';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

export const metadata = { title: '조직 관리 | Marié' };

export default async function OrganizationPage() {
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
        title="조직 관리"
        description="업체를 운영하며 함께 일하는 직원의 권한을 분리해서 관리합니다."
      />
      <OrganizationManager profileId={profileId} />
    </div>
  );
}
