import { Suspense } from 'react';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import PostFilters from '@/features/community/components/PostFilters';
import BoardNav, { type BoardCount } from '@/features/community/components/BoardNav';
import BoardList from '@/features/community/components/BoardList';
import type { Post } from '@/types/database';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';
import LoadErrorState from '@/shared/components/LoadErrorState';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '웨딩 업계 커뮤니티',
  description: '웨딩 업계 종사자들의 커뮤니티. 업계 뉴스, 실무 노하우, 취업·채용 팁, 후기와 자유게시판.',
  alternates: { canonical: '/community' },
  openGraph: { title: '웨딩 업계 커뮤니티 | Marié', description: '웨딩 업계 종사자들의 커뮤니티. 업계 뉴스·노하우·후기.', url: '/community' },
};

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/** 게시판별 글 수 + 오늘 새 글 — 카페가 살아있는지 보여주는 유일한 지표라 목록과 함께 읽는다. */
async function getBoardCounts(): Promise<{ counts: BoardCount[]; totalAll: number; todayAll: number }> {
  const supabase = createServerQueryClient();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabase
    .from('posts')
    .select('category, created_at')
    .is('deleted_at', null)
    .limit(5000);

  const rows = data ?? [];
  const map = new Map<string, BoardCount>();
  let todayAll = 0;
  for (const r of rows) {
    const cat = (r.category as string) || 'free';
    if (!map.has(cat)) map.set(cat, { category: cat, total: 0, today: 0 });
    const e = map.get(cat)!;
    e.total += 1;
    if ((r.created_at as string) >= dayAgo) { e.today += 1; todayAll += 1; }
  }
  return { counts: [...map.values()], totalAll: rows.length, todayAll };
}

async function getPosts(searchParams: Record<string, string | undefined>) {
  const supabase = createServerQueryClient();
  const page = Number(searchParams.page) || 1;
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort = searchParams.sort || 'latest';

  let query = supabase
    .from('posts')
    .select(`*, author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS}), comments:comments!comments_post_id_fkey(count)`, { count: 'exact' })
    .is('deleted_at', null)
    .filter('comments.deleted_at', 'is', null);

  if (searchParams.category) query = query.eq('category', searchParams.category);
  if (searchParams.search) {
    const term = normalizeSearchTerm(searchParams.search);
    if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  }

  // 공지는 항상 맨 위 — 카페 목록의 기본 규칙
  query = query.order('is_notice', { ascending: false });
  if (sort === 'popular') {
    query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }
  query = query.range(from, to);

  const { data, count, error } = await query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (data ?? []).map((row: any) => {
    const { comments: commentAgg, ...rest } = row;
    return { ...rest, comment_count: commentAgg?.[0]?.count ?? 0 } as Post;
  });

  return { posts, count: count ?? 0, error: !!error };
}

export default async function CommunityPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const [{ posts, count, error }, boards] = await Promise.all([
    getPosts(resolved),
    getBoardCounts(),
  ]);

  return (
    <div className="space-y-4">
      {/* 카페 머리 — 이름과 활동량. 커뮤니티는 '사람이 있다'가 먼저 읽혀야 한다. */}
      <header className="border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold text-ink sm:text-[24px]">웨딩 업계 커뮤니티</h1>
            <p className="mt-1 text-[13px] text-gray-500">
              예식장·드레스·스튜디오·메이크업·플래너, 현장에서 일하는 사람들이 묻고 답하는 곳입니다.
            </p>
          </div>
          <dl className="flex shrink-0 items-center gap-4 text-[13px]">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-gray-400">전체 글</dt>
              <dd className="font-bold text-ink tabular-nums">{boards.totalAll.toLocaleString()}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-gray-400">오늘</dt>
              <dd className={`font-bold tabular-nums ${boards.todayAll > 0 ? 'text-state-urgent' : 'text-ink'}`}>
                {boards.todayAll.toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[188px_minmax(0,1fr)] lg:items-start">
        <Suspense fallback={null}>
          <BoardNav counts={boards.counts} totalAll={boards.totalAll} todayAll={boards.todayAll} />
        </Suspense>

        <div className="min-w-0 space-y-3">
          <Suspense fallback={null}>
            <PostFilters />
          </Suspense>
          {error ? (
            <LoadErrorState message="게시글을 불러오지 못했습니다." />
          ) : (
            <Suspense fallback={null}>
              <BoardList posts={posts} totalCount={count} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
