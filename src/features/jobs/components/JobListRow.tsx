import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import { getDDayLabel, isUrgent } from '@/shared/utils/tier';
import VerificationBadge from '@/features/verification/components/VerificationBadge';

interface Props {
  job: Job;
  index?: number;
}

/**
 * 사람인 스타일 가로 row.
 *
 * 데스크톱 grid (모바일에선 별도 flex 레이아웃):
 * | ① 번호 (32px) | ② 회사 (180px) | ③ 제목+키워드+칩 (1fr) | ④ 메타 3행 (170px) | ⑤ CTA·D-day·등록일 (108px) |
 *
 * 모든 컬럼 top-align (items-start). CTA 버튼은 정적 rose outline — row hover 시 변형 없음.
 */
export default function JobListRow({ job, index }: Props) {
  const dDay = getDDayLabel(job.deadline);
  const urgent = isUrgent(job.deadline);
  const companyName = job.author?.company_name ?? job.author?.contact_name ?? '미상';
  const region = job.author?.region ? getRegionLabel(job.author.region) : getRegionLabel(job.region);
  const employmentLabel = getEmploymentTypeLabel(job.employment_type);
  const businessLabel = getBusinessTypeLabel(job.business_type);
  const experience = experienceLabel(job.experience_min);
  const keywords = extractKeywords(job.description, 5);

  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      className="group block border-b border-gray-100 px-4 py-4 transition-colors hover:bg-primary-50/35"
    >
      {/* ───── 모바일 레이아웃 ───── */}
      <div className="sm:hidden flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-bold text-gray-500 truncate flex items-center gap-1">
            {companyName}
            {job.author && (
              <VerificationBadge
                verificationStatus={job.author.verification_status}
                phoneVerified={job.author.phone_verified}
              />
            )}
          </p>
          <h3 className="text-[15px] font-bold text-ink leading-snug line-clamp-2 mt-1">{job.title}</h3>
          <p className="text-[12.5px] text-gray-500 mt-1.5 truncate">
            {region} · {employmentLabel} · {experience}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className={`text-[13.5px] font-bold tabular-nums ${urgent ? 'text-state-urgent' : 'text-gray-700'}`}>
            {dDay ?? '상시'}
          </p>
          <span className="inline-flex h-8 px-3 items-center rounded-md bg-primary text-[12px] font-bold text-white shadow-sm">
            입사지원
          </span>
        </div>
      </div>

      {/* ───── 데스크톱 레이아웃 ───── */}
      <div className="hidden sm:grid sm:grid-cols-[36px_188px_minmax(0,1fr)_180px_112px] sm:gap-5 sm:items-center">
        {/* ① 순위 번호 — primary 톤으로 좌측 시각 앵커 */}
        <div>
          <p className="text-[20px] font-extrabold text-primary tabular-nums leading-none text-center">
            {index ?? '-'}
          </p>
        </div>

        {/* ② 회사 */}
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold text-ink leading-tight truncate flex items-center gap-1.5">
            {companyName}
            {job.author && (
              <VerificationBadge
                verificationStatus={job.author.verification_status}
                phoneVerified={job.author.phone_verified}
              />
            )}
          </p>
          <p className="text-[12.5px] text-gray-500 mt-1 truncate">{businessLabel}</p>
        </div>

        {/* ③ 제목 + 키워드 + 카테고리 칩 */}
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-ink leading-snug line-clamp-2 group-hover:underline underline-offset-4 decoration-primary">
            {job.title}
          </h3>
          {keywords.length > 0 && (
            <p className="mt-1.5 text-[13px] text-gray-500 leading-snug truncate">
              {keywords.map((k, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1.5 text-gray-300">|</span>}
                  {k}
                </span>
              ))}
              <span className="ml-1.5 text-gray-400">외</span>
            </p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-bold text-primary bg-primary-50 border border-primary-100">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-4 3 3 7-7 4 4M14 9l5 0 0 5" />
            </svg>
            {businessLabel} TOP
          </span>
        </div>

        {/* ④ 메타 (지역 / 경력·고용형태 / 학력) */}
        <div className="flex flex-col gap-1.5 text-[13px] text-gray-600">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="truncate">{region}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12L11.204 3.045c.439-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="truncate">{experience} · {employmentLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
            </svg>
            <span className="truncate">학력무관</span>
          </div>
        </div>

        {/* ⑤ CTA + D-day + 등록일 — primary fill 로 시각 앵커 */}
        <div className="flex flex-col items-stretch gap-1.5">
          <span className="inline-flex items-center justify-center h-10 rounded-md bg-primary text-[13px] font-bold text-white shadow-sm group-hover:bg-primary-dark transition-colors">
            입사지원
          </span>
          <p className={`text-center text-[13.5px] font-bold tabular-nums ${urgent ? 'text-state-urgent' : 'text-gray-700'}`}>
            {dDay ?? '상시'}
          </p>
          <p className="text-center text-[11px] text-gray-400">
            {formatRelativeTime(job.created_at)} 등록
          </p>
        </div>
      </div>
    </Link>
  );
}

function experienceLabel(min: number | null): string {
  if (min === null || min === undefined) return '경력무관';
  if (min === 0) return '신입';
  return `경력 ${min}년+`;
}

// description HTML에서 단어 후보 추출 (제목·태그 제거 후 첫 N개)
function extractKeywords(html: string | null | undefined, max: number): string[] {
  if (!html) return [];
  const plain = html
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[•·▪▶◆※*\-—·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = plain
    .split(/[\s,.|·:;()/]+/)
    .map((t) => t.trim())
    .filter((t) => /^[가-힣A-Za-z][가-힣A-Za-z0-9]{1,7}$/.test(t));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    if (STOP_WORDS.has(t)) continue;
    seen.add(t);
    result.push(t);
    if (result.length >= max) break;
  }
  return result;
}

const STOP_WORDS = new Set<string>([
  '담당', '업무', '내용', '지원', '자격', '근무', '조건', '회사', '경력', '신입', '필수', '우대',
  '및', '등', '의', '를', '을', '에', '와', '관련', '있는', '있음', '없음', '가능', '필요', '제공',
  '예', '대해', '대한', '대규모', '기타', '본인', '저희', '여러분',
]);
