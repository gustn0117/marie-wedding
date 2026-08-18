import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import JobNewSubmit from '@/features/jobs/components/JobNewSubmit';
import { checkBusinessProfileCompleteness, REQUIRED_BUSINESS_FIELDS } from '@/features/jobs/lib/business-profile-completeness';
import { getRegionLabel, getBusinessTypeLabels } from '@/shared/utils/format';

// jobs/new 관문 텍스트에서만 참조 — 코어 로직은 business-profile-completeness.ts

export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(ROUTES.LOGIN);

  if (viewer.accountType === 'individual') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <h2 className="text-lg font-bold text-gray-900">업체 회원 전용 기능입니다</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            공고 등록은 업체 회원만 가능합니다.
            <br />
            업체 회원으로 전환하면 바로 공고를 등록할 수 있어요.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <Link
              href={`${ROUTES.MYPAGE_ACCOUNT_TYPE}?next=${encodeURIComponent(ROUTES.JOBS_NEW)}`}
              className="btn-primary text-sm px-6 py-2.5 inline-block"
            >
              업체 회원으로 전환하기
            </Link>
            <Link href={ROUTES.JOBS} className="btn-outline text-sm px-6 py-2.5 inline-block">목록으로 돌아가기</Link>
          </div>
        </div>
      </div>
    );
  }

  // 업체 프로필 완성도 검증 — DB 전체 컬럼을 다시 가져와서 검증 (cookie에는 일부 필드만 있음)
  const service = createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('id, account_type, company_name, business_type, region, phone, bio')
    .eq('id', viewer.profileId)
    .maybeSingle();

  if (!profile) redirect(ROUTES.LOGIN);

  const check = checkBusinessProfileCompleteness(profile);

  if (!check.isComplete) {
    const currentValues: Record<string, string | null> = {
      company_name: profile.company_name || null,
      business_type: profile.business_type ? getBusinessTypeLabels(profile.business_type).slice(0, 2).join(', ') : null,
      region: profile.region ? getRegionLabel(profile.region) : null,
      phone: profile.phone || null,
    };

    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* 단계 indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <span className="w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center text-[10px] font-bold">1</span>
              프로필 준비
            </span>
            <span className="w-6 h-px bg-gray-300" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
              <span className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-[10px] font-bold">2</span>
              공고 등록
            </span>
          </div>

          {/* 본문 */}
          <header className="text-center mb-8">
            <h1 className="text-[22px] sm:text-2xl font-bold text-ink leading-snug">
              먼저 업체 프로필을<br className="sm:hidden" /> 완성해주세요
            </h1>
            <p className="mt-2 text-[13px] text-gray-500 leading-relaxed">
              지원자는 회사 정보를 보고 지원을 결정해요.<br />
              핵심 4가지만 채우면 바로 공고를 등록할 수 있어요.
            </p>
          </header>

          {/* 체크리스트 — border 없이 행만 */}
          <ul className="border-t border-gray-100 mb-2">
            {REQUIRED_BUSINESS_FIELDS.map((field) => {
              const isMissing = check.missing.some((m) => m.key === field.key);
              const value = currentValues[field.key];
              return (
                <li
                  key={field.key}
                  className="flex items-center gap-3 py-3 border-b border-gray-100"
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      isMissing ? 'bg-gray-100' : 'bg-ink'
                    }`}
                    aria-hidden
                  >
                    {!isMissing && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-semibold ${isMissing ? 'text-gray-400' : 'text-ink'}`}>
                      {field.label}
                    </p>
                    <p className={`text-[11.5px] truncate ${isMissing ? 'text-gray-400' : 'text-gray-500'}`}>
                      {isMissing ? field.hint : value}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] ${isMissing ? 'text-gray-400' : 'text-gray-500'}`}>
                    {isMissing ? '필요' : '완료'}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* 완성도 텍스트 */}
          <p className="text-center text-[11.5px] text-gray-400 mb-7">
            {check.filled} / {check.total} 완료 · 약 1~2분 소요
          </p>

          {/* 액션 */}
          <div className="space-y-2.5">
            <Link
              href={`${ROUTES.MYPAGE_EDIT}?next=${encodeURIComponent(ROUTES.JOBS_NEW)}`}
              className="block w-full h-12 leading-[3rem] text-center rounded-lg bg-ink text-white text-sm font-bold hover:bg-ink/90 transition-colors"
            >
              프로필 작성하러 가기
            </Link>
            <Link
              href={ROUTES.JOBS}
              className="block w-full text-center text-[12.5px] text-gray-500 hover:text-ink py-2 transition-colors"
            >
              나중에 하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[860px] mx-auto space-y-4">
      <div className="saramin-section p-5 flex items-center gap-3">
        <Link href={ROUTES.JOBS} className="p-2 rounded hover:bg-primary-50 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <p className="text-sm font-bold text-primary">Recruit Posting</p>
          <h1 className="text-2xl font-bold text-gray-900">공고 등록</h1>
        </div>
      </div>

      <JobNewSubmit profileId={profile.id} />
    </div>
  );
}
