import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import type { Profile } from '@/types/database';
import DirectoryForm from '@/features/directory/components/DirectoryForm';

export const dynamic = 'force-dynamic';

async function getProfile(profileId: string): Promise<Profile | null> {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();
  return data as Profile | null;
}

export default async function DirectoryRegisterPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');

  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let cookieProfile: { id: string } | null = null;
  try { cookieProfile = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!cookieProfile?.id) redirect(ROUTES.LOGIN);

  const profile = await getProfile(cookieProfile.id);
  if (!profile) redirect(ROUTES.LOGIN);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.MYPAGE} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">디렉토리 등록 / 수정</h1>
      </div>

      <DirectoryForm profile={profile} />
    </div>
  );
}
