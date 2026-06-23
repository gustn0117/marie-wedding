import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES, BUSINESS_TYPES } from '@/shared/constants';
import { APPLICATION_STATUS_LABELS } from '@/features/applications/services/application-service';
import {
  formatDate,
  formatRelativeTime,
  getRegionLabel,
  getEmploymentTypeLabel,
} from '@/shared/utils/format';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';
import VerificationBadge from '@/features/verification/components/VerificationBadge';
import type { Application, Job, Profile } from '@/types/database';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
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
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const supabase = createServerQueryClient();
  const { data: appData } = await supabase
    .from('applications')
    .select('*, job:jobs(*, author:profiles!author_id(*)), applicant:profiles(*)')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!appData) notFound();
  const application = appData as Application & {
    job?: Job & { author?: Profile };
    applicant?: Profile;
  };

  const job = application.job;
  const applicant = application.applicant;
  if (!job || !applicant) notFound();

  const isHiring = me.id === job.author_id;
  const isApplicant = me.id === application.applicant_id;
  if (!isHiring && !isApplicant) redirect(ROUTES.MYPAGE);

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
              <p className="text-base font-bold text-ink truncate flex items-center gap-1.5 group-hover:text-primary transition-colors">
                {applicantName}
                <VerificationBadge
                  verificationStatus={applicant.verification_status}
                  phoneVerified={applicant.phone_verified}
                />
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {bizLabel} · {getRegionLabel(applicant.region)}
                {applicant.completed_deals_count > 0 && ` · 진행 ${applicant.completed_deals_count}건`}
                {applicant.response_rate > 0 && ` · 응답률 ${Math.round(applicant.response_rate)}%`}
              </p>
              <p className="text-[11px] text-primary mt-1">프로필 자세히 보기 →</p>
            </div>
          </Link>
        </section>
      )}

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
