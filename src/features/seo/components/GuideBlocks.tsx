import Link from 'next/link';
import type { LandingRole } from '@/features/seo/landings';

// 채용 가이드(/guide/[slug]) 화면 조각. 모두 서버 컴포넌트 — 본문이 HTML 에 그대로 실려 검색·AI 가 읽는다.
// 디자인 원칙: 강조는 '일의 흐름'(GuideTimeline) 한 곳에만. 나머지는 상자 대신 가는 구분선과 글자 위계로 정리하고,
// 번호는 실제 순서가 있는 내용(흐름·성장 경로)에만 쓴다.

/** '제목 — 설명' 을 [제목, 설명] 으로. 구분자가 없으면 [null, 전체] */
function splitItem(text: string): [string | null, string] {
  const at = text.indexOf(' — ');
  return at > 0 ? [text.slice(0, at), text.slice(at + 3)] : [null, text];
}

function CheckIcon() {
  return (
    <svg className="mt-[5px] h-4 w-4 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.6} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

/**
 * 일의 흐름 — 옅은 네이비 띠 위의 식순표. 넓은 화면(xl)에서는 번호 점을 가로 선으로 잇고,
 * 그보다 좁으면 세로로 잇는다. 페이지에서 유일하게 색 면을 쓰는 곳.
 */
export function GuideTimeline({ items }: { items: string[] }) {
  const cols = items.length >= 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4';
  return (
    <div className="rounded-2xl bg-primary-50 px-6 py-8 sm:px-8 xl:px-10 xl:py-12">
      <ol className={`xl:grid xl:gap-6 ${cols}`}>
        {items.map((item, i) => {
          const [title, desc] = splitItem(item);
          const last = i === items.length - 1;
          return (
            <li key={item} className="relative flex gap-5 pb-8 last:pb-0 xl:flex-col xl:gap-5 xl:pb-0">
              {/* 연결선 — 좁은 화면은 아래로, xl 은 오른쪽 다음 점까지 */}
              {!last && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-[17px] top-10 w-px bg-primary/20 xl:bottom-auto xl:left-12 xl:right-[-24px] xl:top-[18px] xl:h-px xl:w-auto"
                />
              )}
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 pt-1.5 xl:pt-0">
                {title && <p className="break-keep text-[17px] font-bold leading-snug text-ink">{title}</p>}
                <p className={`break-keep text-[15px] leading-[1.7] text-gray-600 ${title ? 'mt-1.5' : ''}`}>{desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 체크리스트 — 두 단, 상자 없이 */
export function GuideChecklist({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
      {items.map((item) => {
        const [title, desc] = splitItem(item);
        return (
          <li key={item} className="flex gap-3">
            <CheckIcon />
            <p className="break-keep text-[16px] leading-[1.7] text-gray-700">
              {title && <span className="font-bold text-ink">{title} </span>}
              {desc}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** 점 목록 */
export function GuideList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[16px] leading-[1.7] text-gray-700">
          <span aria-hidden className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-gray-400" />
          <span className="break-keep">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** 세부 직무 — 두 단 목록, 위쪽 가는 선으로 구분. 관련 가이드가 있으면 이름이 링크 */
export function RoleList({ roles }: { roles: LandingRole[] }) {
  return (
    <dl className="grid gap-x-12 sm:grid-cols-2">
      {roles.map((role) => (
        <div key={role.name} className="border-t border-gray-200 py-5">
          <dt className="break-keep text-[18px] font-bold text-ink">
            {role.href ? (
              <Link href={role.href} className="underline-offset-4 hover:text-primary hover:underline">
                {role.name}
              </Link>
            ) : (
              role.name
            )}
          </dt>
          <dd className="mt-1.5 break-keep text-[15px] leading-[1.7] text-gray-600">{role.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 성장 경로 — 순서가 있는 단계라 번호를 붙인다 */
export function CareerPath({ steps, note }: { steps: string[]; note: string }) {
  return (
    <div>
      <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-4">
            <span className="flex items-center gap-2.5 text-[17px] font-semibold text-ink">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary text-[13px] font-bold text-primary">
                {i + 1}
              </span>
              {step}
            </span>
            {i < steps.length - 1 && <span aria-hidden className="hidden h-px w-10 bg-gray-300 sm:block" />}
          </li>
        ))}
      </ol>
      <p className="mt-5 max-w-[44em] break-keep text-[15px] leading-[1.7] text-gray-500">{note}</p>
    </div>
  );
}

/** 구직자·업체 팁 — 두 단, 대상이 다르다는 걸 네이비 윗줄로 구분 */
export function TipColumns({
  columns,
}: {
  columns: { title: string; items: string[]; action: { label: string; href: string } }[];
}) {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-12">
      {columns.map((col) => (
        <div key={col.title} className="border-t-2 border-primary pt-5">
          <h3 className="text-[18px] font-bold text-ink">{col.title}</h3>
          <ul className="mt-4 space-y-3">
            {col.items.map((item) => (
              <li key={item} className="flex gap-3 text-[16px] leading-[1.7] text-gray-700">
                <CheckIcon />
                <span className="break-keep">{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href={col.action.href}
            className="mt-4 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
          >
            {col.action.label}
          </Link>
        </div>
      ))}
    </div>
  );
}

/** 자주 묻는 질문 — 펼쳐 보기. 첫 질문은 열어 둔다. 내용은 닫혀 있어도 HTML 에 있어 검색엔진이 읽는다 */
export function FaqList({ faq }: { faq: { q: string; a: string }[] }) {
  return (
    <div className="border-b border-gray-200">
      {faq.map((f, i) => (
        <details key={f.q} className="group border-t border-gray-200" open={i === 0}>
          <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-6 py-4 [&::-webkit-details-marker]:hidden">
            <span className="break-keep text-[17px] font-semibold leading-snug text-ink">{f.q}</span>
            <span aria-hidden className="relative h-4 w-4 shrink-0 text-gray-400 group-open:text-primary">
              <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 bg-current" />
              <span className="absolute left-1/2 top-0 h-4 w-[1.5px] -translate-x-1/2 bg-current transition-transform duration-200 group-open:scale-y-0 motion-reduce:transition-none" />
            </span>
          </summary>
          <p className="max-w-[48em] break-keep pb-6 pr-10 text-[16px] leading-[1.8] text-gray-600">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
