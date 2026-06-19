import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { createServiceClient } from '@/lib/supabase/service';
import JobNewSubmit from '@/features/jobs/components/JobNewSubmit';
import { checkBusinessProfileCompleteness, REQUIRED_BUSINESS_FIELDS } from '@/features/jobs/lib/business-profile-completeness';

export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');

  if (!profileCookie?.value) {
    redirect(ROUTES.LOGIN);
  }

  let cookieProfile: { id: string; account_type: string } | null = null;
  try {
    cookieProfile = JSON.parse(profileCookie.value);
  } catch {
    redirect(ROUTES.LOGIN);
  }

  if (!cookieProfile?.id) redirect(ROUTES.LOGIN);

  if (cookieProfile.account_type === 'individual') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <h2 className="text-lg font-bold text-gray-900">업체 회원 전용 기능입니다</h2>
          <p className="text-sm text-gray-500">공고 등록은 업체 회원만 가능합니다.</p>
          <Link href={ROUTES.JOBS} className="btn-primary text-sm px-6 py-2.5 inline-block">목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  // 업체 프로필 완성도 검증 — DB 전체 컬럼을 다시 가져와서 검증 (cookie에는 일부 필드만 있음)
  const service = createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('id, account_type, company_name, business_type, region, phone, bio')
    .eq('id', cookieProfile.id)
    .maybeSingle();

  if (!profile) redirect(ROUTES.LOGIN);

  const check = checkBusinessProfileCompleteness(profile);

  if (!check.isComplete) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
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

        <div className="bg-white border border-gray-200 rounded p-6 md:p-8 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">업체 프로필 작성 필요</p>
            <h2 className="text-lg font-bold text-ink">먼저 업체 프로필을 완성해주세요</h2>
            <p className="mt-1 text-sm text-gray-600">
              지원자가 우리 회사 정보를 보고 지원합니다. 핵심 정보를 채워야 공고를 게시할 수 있어요.
            </p>
          </div>

          <div className="rounded border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">완성도</span>
              <span className="text-xs font-bold text-gray-700">{check.filled} / {check.total} 항목</span>
            </div>
            <div className="h-2 bg-gray-100">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(check.filled / check.total) * 100}%` }}
                aria-hidden
              />
            </div>
            <ul className="divide-y divide-gray-100">
              {REQUIRED_BUSINESS_FIELDS.map((field) => {
                const isMissing = check.missing.some((m) => m.key === field.key);
                return (
                  <li
                    key={field.key}
                    className={`flex items-start gap-3 px-4 py-3 ${isMissing ? '' : 'bg-emerald-50/40'}`}
                  >
                    <div
                      className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isMissing ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
                      }`}
                      aria-hidden
                    >
                      {isMissing ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isMissing ? 'text-ink' : 'text-emerald-800'}`}>
                        {field.label}
                      </p>
                      <p className="text-[12px] text-gray-500">{field.hint}</p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isMissing ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isMissing ? '미작성' : '완료'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href={`${ROUTES.MYPAGE_EDIT}?next=${encodeURIComponent(ROUTES.JOBS_NEW)}`}
              className="flex-1 h-11 inline-flex items-center justify-center rounded bg-ink text-white text-sm font-bold hover:bg-ink/90 transition-colors"
            >
              프로필 작성하러 가기
            </Link>
            <Link
              href={ROUTES.JOBS}
              className="h-11 inline-flex items-center justify-center rounded border border-gray-300 text-sm font-bold text-gray-700 hover:border-gray-400 transition-colors px-5"
            >
              나중에 하기
            </Link>
          </div>

          <p className="text-[11px] text-gray-400">
            완성도 정보는 등록·검색 신뢰도 향상을 위해 사용되고, 지원자에게는 회사 소개 페이지에 노출됩니다.
          </p>
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
