import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import {
  getPrimaryBusinessTypeLabel,
  getRegionLabel,
  formatDate,
} from '@/shared/utils/format';
import type { Profile, Job, Post, Application } from '@/types/database';
import MyPageTabs from '@/features/mypage/MyPageTabs';
import VerificationStatusPanel from '@/features/verification/components/VerificationStatusPanel';
import OnboardingChecklist from '@/features/mypage/components/OnboardingChecklist';
import RecommendedJobs from '@/features/recommendations/components/RecommendedJobs';
import PendingReviewsSection from '@/features/mypage/components/PendingReviewsSection';
import RecentJobsSection from '@/features/jobs/components/RecentJobsSection';
import BookmarkedJobsSection from '@/features/mypage/components/BookmarkedJobsSection';
import PageHeader from '@/shared/components/PageHeader';

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
      .filter('comments.deleted_at', 'is', null)
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

  // 본인 이메일 조회 (네이버 검수: 이메일 활용 화면 노출용)
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user: authUser } } = await authClient.auth.getUser();
  const userEmail = authUser?.email ?? '';

  const totalJobViews = jobs.reduce((sum: number, j) => sum + (j.view_count || 0), 0);

  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  const isBusinessAcc = profile.account_type === 'business';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="내 작업공간"
        title="마이페이지"
        description={isBusinessAcc
          ? "등록한 공고, 지원 내역, 커뮤니티 활동과 업체 프로필을 한 곳에서 관리합니다."
          : "지원 내역, 스크랩한 공고, 커뮤니티 활동을 한 곳에서 관리합니다."}
        actions={
          isBusinessAcc ? (
            <>
              <Link href={ROUTES.JOBS_NEW} className="btn-primary text-sm">공고 등록</Link>
              <Link href={ROUTES.MYPAGE_DASHBOARD} className="btn-outline text-sm">대시보드</Link>
            </>
          ) : (
            <>
              <Link href={ROUTES.JOBS} className="btn-primary text-sm">공고 둘러보기</Link>
              <Link href={ROUTES.MYPAGE_BOOKMARKS} className="btn-outline text-sm">스크랩한 공고</Link>
            </>
          )
        }
      />

      {/* Profile Card */}
      <div className="surface p-5 sm:p-6">
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
            {userEmail && (
              <p className="mt-1 text-sm text-gray-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span className="truncate">{userEmail}</span>
              </p>
            )}
            {profile.bio && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{profile.bio.replace(/<[^>]+>/g, ' ').trim()}</p>
            )}
          </div>

          <Link href={ROUTES.MYPAGE_EDIT} className="ml-auto shrink-0 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold transition-colors hover:border-primary hover:text-primary">
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
              <span className="text-gray-500">{getPrimaryBusinessTypeLabel(profile.business_type, 2)}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="text-gray-500">{(profile.region ?? '').split(',').map(r => getRegionLabel(r.trim())).filter(Boolean).join(', ') || '지역 미설정'}</span>
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

        {/* Quick actions는 좌측 rail로 대체됨 → 본문 노이즈 제거. */}
      </div>

      {/* Trust Status */}
      <VerificationStatusPanel profile={profile} />

      {/* Onboarding */}
      <OnboardingChecklist profile={profile} portfolioCount={portfolioCount} jobCount={jobs.length} />

      {/* ────────── 본인 활동 (위쪽 우선 노출) ────────── */}
      {/* 활동 통계 — Stats Summary는 아래(필수 데이터 위) */}

      {/* Stats Summary — 회원 유형별 분기.
          업체: 공고 운영(등록 공고/조회수/받은 지원/응답률)
          개인: 노출 안 함 — 커뮤니티·지원 섹션만 표시 */}
      {isBusinessAcc && (
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">공고 운영</p>
          <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
            <WorkspaceMetric label="등록한 공고" value={jobs.length} href="/mypage#registered-jobs" />
            <WorkspaceMetric label="공고 총 조회수" value={totalJobViews} unit="회" href="/mypage/dashboard" />
            <WorkspaceMetric label="받은 지원" value={receivedApplications.length} href="/mypage#received-applications" />
            <WorkspaceMetric
              label="응답률"
              value={Math.round(profile.response_rate ?? 0)}
              unit="%"
              href="/mypage/dashboard"
            />
          </div>
        </section>
      )}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">커뮤니티·지원</p>
        <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
          <WorkspaceMetric label="작성한 게시글" value={posts.length} href="/mypage#my-posts" />
          <WorkspaceMetric label="지원 내역" value={sentApplications.length} href="/mypage#sent-applications" />
          <WorkspaceMetric label="진행 완료" value={profile.completed_deals_count} href="/mypage/dashboard" />
          <WorkspaceMetric
            label="평균 응답"
            value={
              profile.avg_response_minutes
                ? profile.avg_response_minutes < 60
                  ? profile.avg_response_minutes
                  : profile.avg_response_minutes < 1440
                    ? Math.round(profile.avg_response_minutes / 60)
                    : Math.round(profile.avg_response_minutes / 1440)
                : 0
            }
            unit={
              profile.avg_response_minutes
                ? profile.avg_response_minutes < 60
                  ? '분'
                  : profile.avg_response_minutes < 1440
                    ? '시간'
                    : '일'
                : '-'
            }
            href="/mypage/dashboard"
          />
        </div>
      </section>

      {/* Tabs — 본인의 등록 공고 / 게시글 / 지원 내역 (본인 활동의 핵심) */}
      <MyPageTabs jobs={jobs} posts={posts} sentApplications={sentApplications} receivedApplications={receivedApplications} />

      {/* Pending Reviews — 작성 대기 중인 리뷰 (본인 처리 항목) */}
      <PendingReviewsSection profileId={profile.id} />

      {/* ────────── 탐색·추천 (아래쪽) ────────── */}

      {/* Bookmarked Jobs — 스크랩한 공고 */}
      <BookmarkedJobsSection profileId={profile.id} />

      {/* Recommended Jobs — 맞춤 공고 */}
      <RecommendedJobs profile={profile} />

      {/* Recent Jobs — 최근 등록된 공고 */}
      <RecentJobsSection />

      {/* Account — 계정 관리 (위험 액션 격리) */}
      <section className="rounded border border-gray-200 bg-white p-5 md:p-6">
        <h2 className="text-sm font-bold text-ink mb-3">계정</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-700">회원 탈퇴</p>
            <p className="mt-0.5 text-xs text-gray-500">계정과 작성한 공고·게시글이 모두 비공개 처리됩니다.</p>
          </div>
          <Link
            href="/mypage/withdraw"
            className="shrink-0 inline-flex items-center justify-center h-9 px-3 rounded-lg border border-gray-200 bg-white text-[12.5px] font-semibold text-gray-600 hover:border-state-urgent hover:text-state-urgent transition-colors"
          >
            탈퇴 진행
          </Link>
        </div>
      </section>
    </div>
  );
}

function WorkspaceMetric({
  label,
  value,
  unit = '건',
  href,
}: {
  label: string;
  value: number;
  unit?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm font-bold text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-primary">
        {value}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </>
  );

  if (!href) {
    return <div className="metric-tile p-5">{body}</div>;
  }

  return (
    <Link
      href={href}
      className="metric-tile p-5 block transition-colors hover:bg-primary-50/40 hover:border-primary-200"
    >
      {body}
    </Link>
  );
}
