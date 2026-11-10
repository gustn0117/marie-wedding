import { redirect } from 'next/navigation';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { loginHref } from '@/shared/utils/loginRedirect';
import { ROUTES } from '@/shared/constants';
import BlockedUsersList from '@/features/blocks/components/BlockedUsersList';

export const dynamic = 'force-dynamic';

export const metadata = { title: '차단한 사용자', robots: { index: false, follow: false } };

export default async function BlockedUsersPage() {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(loginHref(ROUTES.MYPAGE_BLOCKS));
  return <BlockedUsersList />;
}
