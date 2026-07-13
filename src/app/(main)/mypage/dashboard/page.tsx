import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';
import { formatRelativeTime, getEmploymentTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Application, ApplicationStatus, Job } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = { title: '공고 성과 | Marié' };

const DASHBOARD_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: '접수',
  reviewing: '검토 중',
  accepted: '승인',
  rejected: '거절',
  cancelled: '취소',
};

const PIPELINE_STATUSES: ApplicationStatus[] = ['pending', 'reviewing', 'accepted', 'rejected', 'cancelled'];

interface HiringDashboard {
  jobs: Job[];
  receivedApplications: Application[];
  activeJobs: number;
  totalApplications: number;
  acceptedApplications: number;
  reviewingApplications: number;
  avgApplicationsPerJob: number;
}

async function loadHiringDashboard(profileId: string): Promise<HiringDashboard> {
  const supabase = createServerQueryClient();
  const [jobsRes, receivedRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, status, employment_type, region, created_at')
      .eq('author_id', profileId)
      .eq('posting_type', 'hiring')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 49),
    supabase
      .from('applications')
      .select('id, status, created_at, job:jobs!inner(id, title, author_id), applicant:profiles(id, company_name, contact_name)')
      .eq('job.author_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 99),
  ]);

  const jobs = (jobsRes.data ?? []) as Job[];
  const receivedApplications = (receivedRes.data ?? []) as unknown as Application[];
  const activeJobs = jobs.filter((job) => !['closed', 'filled', 'hidden'].includes(job.status)).length;
  const totalApplications = receivedApplications.length;
  const acceptedApplications = receivedApplications.filter((app) => app.status === 'accepted').length;
  const reviewingApplications = receivedApplications.filter((app) => app.status === 'pending' || app.status === 'reviewing').length;

  return {
    jobs,
    receivedApplications,
    activeJobs,
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
  const topJobs = dashboard.jobs.slice(0, 5); // 최근 등록순 (쿼리에서 created_at DESC)
  const statusCounts = PIPELINE_STATUSES.map((status) => ({
    status,
    label: DASHBOARD_STATUS_LABELS[status],
    count: dashboard.receivedApplications.filter((app) => app.status === status).length,
  }));
  const responseBacklog = dashboard.receivedApplications.filter((app) => app.status === 'pending').length;
  const acceptedRate = dashboard.totalApplications > 0
    ? Math.round((dashboard.acceptedApplications / dashboard.totalApplications) * 1000) / 10
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="공고 성과"
        description="등록한 채용 공고의 지원, 검토 흐름을 한눈에 확인합니다."
        actions={<Link href={ROUTES.JOBS_NEW} className="btn-primary text-sm">+ 공고 등록</Link>}
      />

      {/* Hero — 운영자의 다음 행동(검토 필요한 지원)을 가장 크게. 보조 KPI 는 지원/승인. */}
      <section className="surface-dark text-white p-8">
        <p className="text-[13px] font-bold text-primary-200 mb-3">지금 검토해야 할 지원</p>
        <p className="text-[48px] sm:text-[56px] font-extrabold tabular-nums leading-none tracking-tighter text-white">
          {dashboard.reviewingApplications.toLocaleString()}
          <span className="text-[20px] font-bold text-white/60 ml-2">건</span>
        </p>
        <p className="mt-2 text-[13px] text-white/70">
          {dashboard.reviewingApplications > 0
            ? '지원자가 답변을 기다리고 있어요. 아래 파이프라인에서 확인해주세요.'
            : '모든 지원이 처리되었어요. 새 공고를 열거나 통계를 살펴보세요.'}
        </p>
        <div className="grid grid-cols-3 gap-3 pt-6 mt-6 border-t border-white/10">
          <div>
            <p className="text-[12px] font-semibold text-white/50">미응답</p>
            <p className={`mt-1 text-[18px] font-bold tabular-nums ${responseBacklog > 0 ? 'text-amber-200' : 'text-white'}`}>{responseBacklog}건</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white/50">받은 지원</p>
            <p className="mt-1 text-[18px] font-bold tabular-nums text-white">{dashboard.totalApplications.toLocaleString()}건</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white/50">승인율</p>
            <p className="mt-1 text-[18px] font-bold tabular-nums text-white">{acceptedRate}%</p>
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

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-eyebrow mb-1">채용 파이프라인</p>
            <h2 className="text-base font-bold text-ink">지원자가 어디에서 멈춰 있는지 확인하세요</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="rounded border border-gray-200 px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-400">미응답</p>
              <p className={`text-lg font-extrabold tabular-nums ${responseBacklog > 0 ? 'text-primary' : 'text-gray-900'}`}>{responseBacklog}</p>
            </div>
            <div className="rounded border border-gray-200 px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-400">승인율</p>
              <p className="text-lg font-extrabold tabular-nums text-gray-900">{acceptedRate}%</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {statusCounts.map((item) => (
            <PipelineBar
              key={item.status}
              label={item.label}
              count={item.count}
              total={Math.max(dashboard.totalApplications, 1)}
              highlight={item.status === 'pending' || item.status === 'reviewing'}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="surface overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">내 공고</h2>
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
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
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

function PipelineBar({
  label,
  count,
  total,
  highlight,
}: {
  label: string;
  count: number;
  total: number;
  highlight?: boolean;
}) {
  const width = Math.round((count / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-bold text-gray-700">{label}</span>
        <span className="font-semibold text-gray-400">{count.toLocaleString()}건</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${highlight ? 'bg-primary' : 'bg-gray-400'}`}
          style={{ width: `${width}%` }}
        />
      </div>
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
