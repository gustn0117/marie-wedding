import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES } from '@/shared/constants';
import type { Profile } from '@/types/database';
import DirectoryForm from '@/features/directory/components/DirectoryForm';
import { SELF_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';

export const dynamic = 'force-dynamic';

async function getProfile(profileId: string): Promise<Profile | null> {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('profiles')
    .select(SELF_PROFILE_COLUMNS)
    .eq('id', profileId)
    .single();
  return data as Profile | null;
}

export default async function DirectoryRegisterPage() {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(ROUTES.LOGIN);

  const profile = await getProfile(viewer.profileId);
  if (!profile) redirect(ROUTES.LOGIN);

  return (
    <div className="max-w-[860px] mx-auto space-y-4">
      <div className="saramin-section p-5 flex items-center gap-3">
        <Link href={ROUTES.MYPAGE} className="p-2 rounded hover:bg-primary-50 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <p className="text-sm font-bold text-primary">Public Profile</p>
          <h1 className="text-2xl font-bold text-gray-900">공개 프로필</h1>
        </div>
      </div>

      <DirectoryForm profile={profile} />
    </div>
  );
}
