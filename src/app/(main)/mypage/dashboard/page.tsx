import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';
import { formatRelativeTime, getEmploymentTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Application, Job } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = { title: '공고 성과 | Marié' };

interface HiringDashboard {
  jobs: Job[];
  receivedApplications: Application[];
  sentApplications: Application[];
  activeJobs: number;
  totalViews: number;
  totalApplications: number;
  acceptedApplications: number;
  reviewingApplications: number;
  avgApplicationsPerJob: number;
}

async function loadHiringDashboard(profileId: string): Promise<HiringDashboard> {
  const supabase = createServerQueryClient();
  const [jobsRes, receivedRes, sentRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)')
      .eq('author_id', profileId)
      .eq('posting_type', 'hiring')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 49),
    supabase
      .from('applications')
      .select('*, job:jobs!inner(*), applicant:profiles(*)')
      .eq('job.author_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 99),
    supabase
      .from('applications')
      .select('*, job:jobs(*, author:profiles!author_id(*)), applicant:profiles(*)')
      .eq('applicant_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 99),
  ]);

  const jobs = (jobsRes.data ?? []) as Job[];
  const receivedApplications = (receivedRes.data ?? []) as Application[];
  const sentApplications = (sentRes.data ?? []) as Application[];
  const activeJobs = jobs.filter((job) => !['closed', 'filled', 'hidden'].includes(job.status)).length;
  const totalViews = jobs.reduce((sum, job) => sum + (job.view_count ?? 0), 0);
  const totalApplications = receivedApplications.length;
  const acceptedApplications = receivedApplications.filter((app) => app.status === 'accepted').length;
  const reviewingApplications = receivedApplications.filter((app) => app.status === 'pending' || app.status === 'reviewing').length;

  return {
    jobs,
    receivedApplications,
    sentApplications,
    activeJobs,
    totalViews,
    totalApplications,
    acceptedApplications,
    reviewingApplications,
    avgApplicationsPerJob: jobs.length > 0 ? totalApplications / jobs.length : 0,
  };
}

export default async function DashboardPage() {
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

  const dashboard = await loadHiringDashboard(profileId);
  const topJobs = [...dashboard.jobs]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 5);
  const applicationRate = dashboard.totalViews > 0
    ? Math.round((dashboard.totalApplications / dashboard.totalViews) * 1000) / 10
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="공고 성과"
        description="등록한 채용 공고의 조회, 지원, 검토 흐름을 한눈에 확인합니다."
        actions={<Link href={ROUTES.JOBS_NEW} className="btn-primary text-sm">+ 공고 등록</Link>}
      />

      <section className="surface-dark p-8">
        <p className="text-[13px] font-bold text-primary-200 mb-3">전체 공고 조회수</p>
        <p className="text-[48px] sm:text-[56px] font-extrabold tabular-nums leading-none tracking-tighter">
          {dashboard.totalViews.toLocaleString()}
          <span className="text-[20px] font-bold text-white/60 ml-2">회</span>
        </p>
        <div className="grid grid-cols-2 gap-3 pt-6 mt-6 border-t border-white/10">
          <div>
            <p className="text-[12px] font-semibold text-white/50">지원 전환율</p>
            <p className="mt-1 text-[18px] font-bold tabular-nums">{applicationRate}%</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white/50">공고당 평균 지원</p>
            <p className="mt-1 text-[18px] font-bold tabular-nums">{dashboard.avgApplicationsPerJob.toFixed(1)}건</p>
          </div>
        </div>
      </section>

      <section>
        <p className="section-eyebrow">지원 퍼널</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="등록 공고" value={dashboard.jobs.length} unit="건" href={ROUTES.MYPAGE} />
          <KpiCard label="진행 중 공고" value={dashboard.activeJobs} unit="건" href={ROUTES.MYPAGE} />
          <KpiCard label="받은 지원" value={dashboard.totalApplications} unit="건" href={ROUTES.MYPAGE} />
          <KpiCard label="검토 필요" value={dashboard.reviewingApplications} unit="건" href={ROUTES.MYPAGE} emphasis />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="surface overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">조회 많은 공고</h2>
            <Link href={ROUTES.JOBS_NEW} className="text-xs font-bold text-primary hover:underline">공고 추가</Link>
          </div>
          {topJobs.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">아직 등록한 공고가 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topJobs.map((job) => (
                <Link key={job.id} href={ROUTES.JOBS_DETAIL(job.id)} className="platform-data-row flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{job.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {getEmploymentTypeLabel(job.employment_type)} · {getRegionLabel(job.region)} · {formatRelativeTime(job.created_at)}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-primary tabular-nums">조회 {(job.view_count ?? 0).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="surface p-4">
          <h2 className="text-sm font-bold text-ink mb-3">최근 받은 지원</h2>
          {dashboard.receivedApplications.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">아직 받은 지원이 없습니다.</div>
          ) : (
            <ul className="space-y-3">
              {dashboard.receivedApplications.slice(0, 5).map((app) => (
                <li key={app.id} className="rounded border border-gray-200 p-3">
                  <p className="text-sm font-bold text-ink truncate">{app.job?.title ?? '공고'}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {app.applicant?.company_name || app.applicant?.contact_name || '지원자'} · {formatRelativeTime(app.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  href,
  emphasis,
}: {
  label: string;
  value: number;
  unit: string;
  href: string;
  emphasis?: boolean;
}) {
  return (
    <Link href={href} className={`stat hover:border-gray-300 transition-colors ${emphasis ? 'border-primary' : ''}`}>
      <p className="stat-label">{label}</p>
      <p className={`stat-value mb-1 ${emphasis ? 'text-primary' : ''}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500">{unit}</p>
    </Link>
  );
}
