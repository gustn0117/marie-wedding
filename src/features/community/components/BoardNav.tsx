'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { POST_CATEGORIES, ROUTES } from '@/shared/constants';

export interface BoardCount {
  category: string;
  total: number;
  today: number;
}

interface BoardNavProps {
  counts: BoardCount[];
  totalAll: number;
  todayAll: number;
}

/**
 * 게시판 목록 — 카페의 뼈대.
 *
 * 글 수를 함께 보여주는 게 핵심이다. 카페가 '살아있다'는 신호는 글 수와 오늘 새 글이고,
 * 그게 없으면 그냥 카테고리 필터로만 읽힌다.
 * 데스크탑은 좌측 고정 목록, 모바일은 가로 스크롤 칩으로 같은 정보를 준다.
 */
export default function BoardNav({ counts, totalAll, todayAll }: BoardNavProps) {
  const params = useSearchParams();
  const active = params.get('category') ?? '';
  const byCat = new Map(counts.map((c) => [c.category, c]));

  const href = (category: string) => {
    const next = new URLSearchParams(params.toString());
    if (category) next.set('category', category);
    else next.delete('category');
    next.delete('page');
    const qs = next.toString();
    return qs ? `${ROUTES.COMMUNITY}?${qs}` : ROUTES.COMMUNITY;
  };

  const boards = [
    { value: '', label: '전체글', total: totalAll, today: todayAll },
    ...POST_CATEGORIES.map((c) => ({
      value: c.value as string,
      label: c.label,
      total: byCat.get(c.value)?.total ?? 0,
      today: byCat.get(c.value)?.today ?? 0,
    })),
  ];

  return (
    <>
      {/* 데스크탑 — 좌측 게시판 목록 */}
      <nav className="hidden lg:block" aria-label="게시판">
        <div className="border border-gray-200 bg-white">
          <p className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-[12px] font-bold tracking-wide text-gray-500">
            게시판
          </p>
          <ul>
            {boards.map((b) => {
              const on = active === b.value;
              return (
                <li key={b.value || 'all'}>
                  <Link
                    href={href(b.value)}
                    aria-current={on ? 'page' : undefined}
                    className={`flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5 text-[13.5px] transition-colors last:border-b-0
                      ${on ? 'bg-primary-50/60 font-bold text-primary' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{b.label}</span>
                      {b.today > 0 && (
                        <span className="shrink-0 rounded-sm bg-state-urgent px-1 text-[10px] font-bold leading-[15px] text-white">N</span>
                      )}
                    </span>
                    <span className={`shrink-0 tabular-nums text-[12px] ${on ? 'text-primary' : 'text-gray-400'}`}>
                      {b.total.toLocaleString()}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary mt-3 flex w-full justify-center text-sm">
          글쓰기
        </Link>
      </nav>

      {/* 모바일 — 같은 정보를 가로 칩으로 */}
      <nav className="lg:hidden -mx-3 overflow-x-auto px-3 pb-1" aria-label="게시판">
        <ul className="flex gap-1.5 whitespace-nowrap">
          {boards.map((b) => {
            const on = active === b.value;
            return (
              <li key={b.value || 'all'}>
                <Link
                  href={href(b.value)}
                  aria-current={on ? 'page' : undefined}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition-colors
                    ${on ? 'border-primary bg-primary text-white font-bold' : 'border-gray-300 bg-white text-gray-600'}`}
                >
                  {b.label}
                  <span className={`tabular-nums text-[11px] ${on ? 'text-white/80' : 'text-gray-400'}`}>{b.total}</span>
                  {b.today > 0 && <span className={`text-[10px] font-bold ${on ? 'text-white' : 'text-state-urgent'}`}>N</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
