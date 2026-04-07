import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import {
  getBusinessTypeLabel,
  getRegionLabel,
  formatDate,
} from '@/shared/utils/format';
import type { Profile, Job, Post } from '@/types/database';
import MyPageTabs from '@/features/mypage/MyPageTabs';

export const dynamic = 'force-dynamic';

async function getMyData(profileId: string) {
  const supabase = createServerQueryClient();

  const [profileRes, jobsRes, postsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId).single(),
    supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)')
      .eq('author_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 49),
    supabase
      .from('posts')
      .select('*, author:profiles!author_id(*), comments:comments(count)')
      .eq('author_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 49),
  ]);

  const profile = profileRes.data as Profile | null;
  const jobs = (jobsRes.data ?? []) as Job[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (postsRes.data ?? []).map((row: any) => {
    const { comments: commentAgg, ...rest } = row;
    return { ...rest, comment_count: commentAgg?.[0]?.count ?? 0 } as Post;
  });

  return { profile, jobs, posts };
}

export default async function MyPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');

  if (!profileCookie?.value) {
    redirect(ROUTES.LOGIN);
  }

  let cookieProfile: { id: string } | null = null;
  try {
    cookieProfile = JSON.parse(profileCookie.value);
  } catch {
    redirect(ROUTES.LOGIN);
  }

  if (!cookieProfile?.id) redirect(ROUTES.LOGIN);

  const { profile, jobs, posts } = await getMyData(cookieProfile.id);

  if (!profile) redirect(ROUTES.LOGIN);

  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">마이페이지</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-xl">
                  {(profile.company_name || profile.contact_name).charAt(0)}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {profile.company_name || profile.contact_name}
              </h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                profile.account_type === 'business' ? 'bg-primary-50 text-primary' : 'bg-gray-100 text-gray-600'
              }`}>
                {profile.account_type === 'business' ? '업체' : '개인'}
              </span>
            </div>
            {profile.account_type === 'business' && profile.contact_name && (
              <p className="text-sm text-gray-500">{profile.contact_name}</p>
            )}
            {profile.bio && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{profile.bio}</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Link href={ROUTES.MYPAGE_EDIT} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              프로필 수정
            </Link>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profile.business_type && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
              <span className="text-gray-500">{getBusinessTypeLabel(profile.business_type)}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="text-gray-500">{getRegionLabel(profile.region)}</span>
          </div>
          {profile.phone && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <span className="text-gray-500">{profile.phone}</span>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{profile.website}</a>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-gray-500">{formatDate(profile.created_at)} 가입</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
          <Link href={ROUTES.MYPAGE_EDIT} className="text-sm text-gray-500 hover:text-primary transition-colors">프로필 수정</Link>
          <span className="text-gray-200">|</span>
          <Link href={ROUTES.MYPAGE_PASSWORD} className="text-sm text-gray-500 hover:text-primary transition-colors">비밀번호 변경</Link>
          <span className="text-gray-200">|</span>
          <Link href={ROUTES.DIRECTORY_REGISTER} className="text-sm text-gray-500 hover:text-primary transition-colors flex items-center gap-1">
            디렉토리 등록
            {profile.is_directory_listed && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
          </Link>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">등록한 공고</p>
          <p className="text-2xl font-bold text-gray-900">{jobs.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">작성한 게시글</p>
          <p className="text-2xl font-bold text-gray-900">{posts.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
      </div>

      {/* Tabs */}
      <MyPageTabs jobs={jobs} posts={posts} />
    </div>
  );
}
