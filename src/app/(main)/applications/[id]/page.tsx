import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES, BUSINESS_TYPES } from '@/shared/constants';
import { APPLICATION_STATUS_LABELS } from '@/features/applications/services/application-service';
import {
  formatDate,
  formatRelativeTime,
  getRegionLabel,
  getEmploymentTypeLabel,
} from '@/shared/utils/format';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';
import type { Application, Job, Profile } from '@/types/database';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';
import ResumePreview from '@/features/resumes/components/ResumePreview';
import { parseSubmittedResumeSnapshot } from '@/features/resumes/lib/mapper';
import { isUuid } from '@/shared/utils/uuid';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * QA-013 — 받은 지원 목록에서 지원서 클릭 시 404 발생 → 전용 상세 페이지 신설.
 *
 * 양측(공고 작성자 / 지원자) 모두 접근 가능.
 *  - 공고 작성자: 지원자 프로필 + 메시지 + 연락처 + 상태 확인
 *  - 지원자: 자기 지원서 내용 + 진행 상태 확인
 *  - 그 외: /mypage 로 redirect
 */
export default async function ApplicationDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(ROUTES.LOGIN);

  const supabase = createServerQueryClient();
  const signal = AbortSignal.timeout(10_000);
  const { data: rawAccessRow, error: accessError } = await supabase
    .from('applications')
    .select('id, applicant_id, job_id, job:jobs!inner(author_id)')
    .eq('id', id)
    .is('deleted_at', null)
    .abortSignal(signal)
    .maybeSingle();
  if (accessError) {
    console.error('[application-detail] access lookup failed:', accessError.message);
    if (signal.aborted) throw new Error('지원서 조회 시간이 초과되었습니다.');
  }
  const accessRow = rawAccessRow as unknown as {
    id: string;
    applicant_id: string;
    job_id: string;
    job?: { author_id: string } | Array<{ author_id: string }>;
  } | null;
  if (!accessRow) notFound();

  const isApplicant = viewer.profileId === accessRow.applicant_id;
  const accessJob = Array.isArray(accessRow.job) ? accessRow.job[0] : accessRow.job;
  const isHiring = viewer.profileId === accessJob?.author_id;
  if (!isHiring && !isApplicant) redirect(ROUTES.MYPAGE);

  // 지원 당사자 확인이 끝난 뒤에만 메시지·연락처·비공개 채용 메모를 읽는다.
  const [{ data: appData, error: applicationError }, { data: snapshotRow, error: snapshotError }] = await Promise.all([
    supabase
      .from('applications')
      .select(`*, job:jobs(*, author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS})), applicant:profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('id', id)
      .is('deleted_at', null)
      .abortSignal(signal)
      .maybeSingle(),
    supabase
      .from('application_resume_snapshots')
      .select('snapshot, created_at')
      .eq('application_id', id)
      .abortSignal(signal)
      .maybeSingle(),
  ]);
  if (applicationError) {
    console.error('[application-detail] application lookup failed:', applicationError.message);
    if (signal.aborted) throw new Error('지원서 조회 시간이 초과되었습니다.');
  }

  if (!appData) notFound();
  const application = appData as Application & {
    job?: Job & { author?: Profile };
    applicant?: Profile;
  };

  const job = application.job;
  const applicant = application.applicant;
  if (!job || !applicant) notFound();

  // 이력서는 지원 당사자 확인이 끝난 뒤에만 서버에서 별도 조회한다.
  // applications.* 일반 목록 쿼리에 학력·경력·연락처 payload가 실리지 않게 한다.
  if (snapshotError) {
    console.error('[application-detail] resume snapshot lookup failed:', snapshotError.message);
  }
  const submittedResume = parseSubmittedResumeSnapshot(snapshotRow?.snapshot);

  const applicantAvatar = resolveStorageUrl(applicant.profile_image, 'avatars');
  const applicantName = applicant.company_name || applicant.contact_name || '지원자';
  const initial = applicantName.charAt(0).toUpperCase();
  const bizLabel = (() => {
    const bt = applicant.business_type;
    if (!bt) return '분야 미입력';
    const first = bt.split(',')[0].trim();
    return BUSINESS_TYPES.find((b) => b.value === first)?.label ?? '분야 미입력';
  })();

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href={ROUTES.MYPAGE} className="text-gray-500 hover:text-primary transition-colors">
          마이페이지
        </Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium truncate">지원서 상세</span>
      </nav>

      {/* Job context */}
      <section className="rounded-xl bg-white border border-gray-200 p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">지원 공고</p>
        <Link href={ROUTES.JOBS_DETAIL(job.id)} className="block group">
          <h1 className="text-lg font-bold text-ink group-hover:text-primary transition-colors truncate">
            {job.title}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            {getRegionLabel(job.region)} · {getEmploymentTypeLabel(job.employment_type)}
            {job.deadline && ` · 마감 ${formatDate(job.deadline)}`}
          </p>
        </Link>
      </section>

      {/* Application status */}
      <section className="rounded-xl bg-white border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">진행 상태</p>
          <span className="badge-attr">{APPLICATION_STATUS_LABELS[application.status]}</span>
        </div>
        <p className="text-sm text-gray-600">
          {formatRelativeTime(application.created_at)} 접수
          {application.contact_phone && ` · 연락처 ${application.contact_phone}`}
        </p>
      </section>

      {/* Applicant card (hiring side만 노출) */}
      {isHiring && (
        <section className="rounded-xl bg-white border border-gray-200 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">지원자</p>
          <Link
            href={ROUTES.DIRECTORY_DETAIL(applicant.id)}
            className="flex items-center gap-4 group"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
              {applicantAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={applicantAvatar} alt={applicantName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-gray-300">{initial}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-ink truncate group-hover:text-primary transition-colors">
                {applicantName}
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {bizLabel}
                {getRegionLabel(applicant.region) ? ` · ${getRegionLabel(applicant.region)}` : ''}
                {applicant.completed_deals_count > 0 && ` · 진행 ${applicant.completed_deals_count}건`}
                {applicant.response_rate > 0 && ` · 응답률 ${Math.round(applicant.response_rate)}%`}
              </p>
              <p className="text-[11px] text-primary mt-1">프로필 자세히 보기 →</p>
            </div>
          </Link>
        </section>
      )}

      {/* 지원 시점에 고정된 이력서 제출본 */}
      <section className="rounded-xl bg-white border border-gray-200 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">제출 이력서</p>
            <p className="mt-1 text-xs text-gray-500">지원 시점의 내용으로 보관된 제출본입니다.</p>
          </div>
          {submittedResume && <span className="badge-attr">제출본 · 변경 불가</span>}
        </div>
        {submittedResume ? (
          <ResumePreview
            resume={submittedResume}
            submittedAt={snapshotRow?.created_at ?? application.created_at}
          />
        ) : application.resume_id ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
            제출된 이력서를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.
          </div>
        ) : (
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-5 text-sm leading-6 text-gray-600">
            이 지원은 이력서 제출 기능 도입 전에 접수되어 별도 제출본이 없습니다. 아래 지원 메시지와 프로필 정보를 확인해주세요.
          </div>
        )}
      </section>

      {/* Message body */}
      <section className="rounded-xl bg-white border border-gray-200 p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">지원 메시지</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
          {application.message}
        </p>
      </section>

      {/* Author note (hiring 전용) */}
      {isHiring && application.author_note && (
        <section className="rounded-xl bg-secondary-50 border border-secondary-100 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">내 메모 (비공개)</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
            {application.author_note}
          </p>
        </section>
      )}

      {/* Action: 공고로 이동해 상태 변경 */}
      <div className="flex justify-between items-center pt-2">
        <Link
          href={ROUTES.MYPAGE}
          className="text-sm text-gray-500 hover:text-primary"
        >
          ← 목록으로
        </Link>
        <Link
          href={`${ROUTES.JOBS_DETAIL(job.id)}#apply`}
          className="btn-primary text-sm"
        >
          공고 페이지에서 관리 →
        </Link>
      </div>
    </main>
  );
}
