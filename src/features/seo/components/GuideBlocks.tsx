import Link from 'next/link';
import type { LandingRole, LandingSection } from '@/features/seo/landings';

// 채용 가이드(/guide/[slug]) 화면 조각. 모두 서버 컴포넌트 — 본문이 HTML 에 그대로 실려 검색·AI 가 읽는다.

/** '제목 — 설명' 을 [제목, 설명] 으로. 구분자가 없으면 [null, 전체] */
function splitItem(text: string): [string | null, string] {
  const at = text.indexOf(' — ');
  return at > 0 ? [text.slice(0, at), text.slice(at + 3)] : [null, text];
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-5 w-5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

/** 본문 항목 — steps: 번호 흐름(세로 연결선) · check: 체크리스트 카드 · list: 점 목록 */
export function GuideItems({ items, variant }: { items: string[]; variant: NonNullable<LandingSection['itemStyle']> }) {
  if (variant === 'steps') {
    return (
      <ol>
        {items.map((item, i) => {
          const [title, desc] = splitItem(item);
          return (
            <li key={item} className="relative flex gap-5 pb-8 last:pb-0">
              {i < items.length - 1 && <span aria-hidden className="absolute bottom-0 left-[17px] top-10 w-px bg-gray-200" />}
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 pt-1.5">
                {title && <p className="break-keep text-[16px] font-bold text-ink sm:text-[17px]">{title}</p>}
                <p className={`break-keep text-[15px] leading-relaxed text-gray-600 sm:text-[16px] ${title ? 'mt-1' : ''}`}>{desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  if (variant === 'check') {
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const [title, desc] = splitItem(item);
          return (
            <li key={item} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <CheckIcon />
              <div className="min-w-0">
                {title && <p className="text-[15px] font-bold text-ink">{title}</p>}
                <p className={`break-keep text-[15px] leading-relaxed text-gray-700 ${title ? 'mt-0.5' : ''}`}>{desc}</p>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-gray-700 sm:text-[16px]">
          <span aria-hidden className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          <span className="break-keep">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** 세부 직무 카드. 관련 가이드가 있으면 카드 전체가 링크 */
export function RoleCard({ role }: { role: LandingRole }) {
  const inner = (
    <>
      <p className="break-keep text-[17px] font-bold text-ink">{role.name}</p>
      <p className="mt-2 break-keep text-[14px] leading-relaxed text-gray-600 sm:text-[15px]">{role.desc}</p>
      {role.href && (
        <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
          가이드 보기 <ArrowIcon className="h-3.5 w-3.5" />
        </span>
      )}
    </>
  );
  const cls = 'block h-full rounded-2xl border border-gray-200 bg-white p-6 transition-colors';
  return role.href ? (
    <Link href={role.href} className={`${cls} hover:border-primary`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** 구직자·업체 팁 카드 */
export function TipCard({
  title,
  items,
  action,
}: {
  title: string;
  items: string[];
  action: { label: string; href: string };
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-7">
      <p className="text-[17px] font-bold text-ink">{title}</p>
      <ul className="mt-4 flex-1 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-gray-700">
            <CheckIcon />
            <span className="break-keep">{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href={action.href}
        className="mt-6 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[14px] font-bold text-primary underline-offset-4 hover:underline"
      >
        {action.label} <ArrowIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
