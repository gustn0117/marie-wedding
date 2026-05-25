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
import type { Profile, Job, Post, Application } from '@/types/database';
import MyPageTabs from '@/features/mypage/MyPageTabs';
import VerificationStatusPanel from '@/features/verification/components/VerificationStatusPanel';
import OnboardingChecklist from '@/features/mypage/components/OnboardingChecklist';
import RecommendedJobs from '@/features/recommendations/components/RecommendedJobs';

export const dynamic = 'force-dynamic';

async function getMyData(profileId: string) {
  const supabase = createServerQueryClient();

  const [profileRes, jobsRes, postsRes, sentApplicationsRes, receivedApplicationsRes, portfoliosRes] = await Promise.all([
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
    supabase
      .from('applications')
      .select('*, job:jobs(*, author:profiles!author_id(*)), applicant:profiles(*)')
      .eq('applicant_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 49),
    supabase
      .from('applications')
      .select('*, job:jobs!inner(*), applicant:profiles(*)')
      .eq('job.author_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 49),
    supabase
      .from('portfolios')
      .select('id')
      .eq('profile_id', profileId)
      .is('deleted_at', null),
  ]);

  const profile = profileRes.data as Profile | null;
  const jobs = (jobsRes.data ?? []) as Job[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (postsRes.data ?? []).map((row: any) => {
    const { comments: commentAgg, ...rest } = row;
    return { ...rest, comment_count: commentAgg?.[0]?.count ?? 0 } as Post;
  });

  return {
    profile,
    jobs,
    posts,
    sentApplications: (sentApplicationsRes.data ?? []) as Application[],
    receivedApplications: (receivedApplicationsRes.data ?? []) as Application[],
    portfolioCount: (portfoliosRes.data ?? []).length,
  };
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

  const { profile, jobs, posts, sentApplications, receivedApplications, portfolioCount } = await getMyData(cookieProfile.id);

  if (!profile) redirect(ROUTES.LOGIN);

  const totalJobViews = jobs.reduce((sum: number, j) => sum + (j.view_count || 0), 0);

  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <section className="platform-panel p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="platform-eyebrow">My Workspace</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight text-gray-950">마이페이지</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">
              등록한 공고, 지원 내역, 커뮤니티 활동과 업체 프로필을 한 곳에서 관리합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href={ROUTES.JOBS_NEW} className="btn-primary min-h-[44px]">공고 등록</Link>
            <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-secondary min-h-[44px]">업체 관리</Link>
          </div>
        </div>
      </section>

      {/* Profile Card */}
      <div className="platform-panel p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
            {imageUrl ? (
              <img src={imageUrl} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">
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
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{profile.bio.replace(/<[^>]+>/g, ' ').trim()}</p>
            )}
          </div>

          <Link href={ROUTES.MYPAGE_EDIT} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-colors shrink-0 ml-auto">
            프로필 수정
          </Link>
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
            <span className="text-gray-500">{profile.region.split(',').map(r => getRegionLabel(r.trim())).join(', ')}</span>
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
        <div className="mt-4 pt-4 border-t border-gray-100 grid gap-2 sm:grid-cols-4">
          <Link href={ROUTES.MYPAGE_EDIT} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors">프로필 수정</Link>
          <Link href={ROUTES.MYPAGE_PORTFOLIOS} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors">포트폴리오</Link>
          <Link href={ROUTES.MYPAGE_AVAILABILITY} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors">가용 일정</Link>
          <Link href={ROUTES.MYPAGE_MESSAGES} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors">메시지</Link>
          <Link href={ROUTES.MYPAGE_SAVED_SEARCHES} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors">저장한 검색</Link>
          <Link href={ROUTES.MYPAGE_NOTIFICATIONS} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors">알림</Link>
          <Link href={ROUTES.MYPAGE_PASSWORD} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors">비밀번호</Link>
          <Link href={ROUTES.DIRECTORY_REGISTER} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors flex items-center gap-1">
            디렉토리 등록
            {profile.is_directory_listed && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
          </Link>
        </div>
      </div>

      {/* Trust Status */}
      <VerificationStatusPanel profile={profile} />

      {/* Onboarding */}
      <OnboardingChecklist profile={profile} portfolioCount={portfolioCount} jobCount={jobs.length} />

      {/* Recommended Jobs */}
      <RecommendedJobs profile={profile} />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WorkspaceMetric label="등록한 공고" value={jobs.length} />
        <WorkspaceMetric label="공고 총 조회수" value={totalJobViews} unit="회" />
        <WorkspaceMetric label="받은 지원" value={receivedApplications.length} />
        <WorkspaceMetric
          label="응답률"
          value={Math.round(profile.response_rate ?? 0)}
          unit="%"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WorkspaceMetric label="작성한 게시글" value={posts.length} />
        <WorkspaceMetric label="지원 내역" value={sentApplications.length} />
        <WorkspaceMetric label="거래 완료" value={profile.completed_deals_count} />
        <WorkspaceMetric
          label="평균 응답"
          value={profile.avg_response_minutes ?? 0}
          unit={profile.avg_response_minutes ? (profile.avg_response_minutes < 60 ? '분' : profile.avg_response_minutes < 1440 ? '분' : '분') : '-'}
        />
      </div>

      {/* Tabs */}
      <MyPageTabs jobs={jobs} posts={posts} sentApplications={sentApplications} receivedApplications={receivedApplications} />
    </div>
  );
}

function WorkspaceMetric({ label, value, unit = '건' }: { label: string; value: number; unit?: string }) {
  return (
    <div className="metric-tile p-5">
      <p className="text-sm font-bold text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-950">
        {value}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}
