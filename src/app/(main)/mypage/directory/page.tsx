import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Profile } from '@/types/database';
import DirectoryToggle from '@/features/directory/components/DirectoryToggle';

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

  const missingInfo = !profile.contact_name || !profile.region;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.MYPAGE} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">업체 디렉토리 등록</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">디렉토리 등록 상태</h2>
            <p className="text-sm text-gray-500 mt-1">디렉토리에 업체를 공개하면 다른 사용자가 업체를 찾을 수 있습니다.</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            profile.is_directory_listed ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {profile.is_directory_listed ? '등록됨' : '미등록'}
          </span>
        </div>

        {/* Preview */}
        <div className="border border-gray-200 rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-400 mb-3">디렉토리에 표시될 정보 미리보기</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold">{(profile.company_name || profile.contact_name || '?').charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{profile.company_name || profile.contact_name || '-'}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{profile.business_type ? getBusinessTypeLabel(profile.business_type) : '-'}</span>
                <span>·</span>
                <span>{getRegionLabel(profile.region)}</span>
              </div>
            </div>
          </div>
          {profile.bio && <p className="text-sm text-gray-500 line-clamp-2">{profile.bio}</p>}

          {missingInfo && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-700">
                이름, 지역 정보가 모두 입력되어야 등록할 수 있습니다.
                <Link href={ROUTES.MYPAGE_EDIT} className="ml-1 text-yellow-800 font-semibold underline">프로필 수정</Link>
              </p>
            </div>
          )}
        </div>

        {/* Toggle Button (Client Component) */}
        <DirectoryToggle
          profileId={profile.id}
          initialListed={profile.is_directory_listed}
          missingInfo={missingInfo}
        />
      </div>

      <div className="bg-gray-50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">디렉토리 등록 안내</h3>
        <ul className="space-y-1.5 text-[13px] text-gray-500">
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">-</span>
            등록하면 업체 디렉토리에 업체 정보가 공개됩니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">-</span>
            프로필 사진, 소개글을 작성하면 더 많은 관심을 받을 수 있습니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">-</span>
            언제든지 디렉토리에서 내릴 수 있습니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
