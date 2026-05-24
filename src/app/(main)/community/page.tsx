import { Suspense } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import PostFilters from '@/features/community/components/PostFilters';
import PostList from '@/features/community/components/PostList';
import type { Post } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '커뮤니티 | 마리에',
  description: '웨딩업계 종사자들의 커뮤니티. 업계뉴스, 노하우 공유, 자유게시판.',
};

interface PageProps {
  searchParams: Record<string, string | undefined>;
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
    .select('*, author:profiles!author_id(*), comments:comments(count)', { count: 'exact' })
    .is('deleted_at', null);

  if (searchParams.category) {
    query = query.eq('category', searchParams.category);
  }
  if (searchParams.search) {
    const escaped = searchParams.search.replace(/[%_]/g, '\\$&');
    query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
  }

  // 정렬 옵션
  if (sort === 'popular') {
    query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false });
  } else if (sort === 'views') {
    query = query.order('view_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(from, to);

  const { data, count } = await query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (data ?? []).map((row: any) => {
    const { comments: commentAgg, ...rest } = row;
    return { ...rest, comment_count: commentAgg?.[0]?.count ?? 0 } as Post;
  });

  return { posts, count: count ?? 0 };
}

export default async function CommunityPage({ searchParams }: PageProps) {
  const { posts, count } = await getPosts(searchParams);

  return (
    <div className="space-y-4">
      <section className="saramin-section p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-sm font-bold text-primary">Community</p>
            <h1 className="text-h2 font-black text-gray-900">커뮤니티</h1>
            <p className="mt-1 text-small text-gray-500">현장 노하우, 업계 소식, 구인 경험을 웨딩업계 종사자들과 나눠보세요.</p>
          </div>
          <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            글쓰기
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-3">
          <Suspense fallback={null}>
            <PostFilters />
          </Suspense>
          <PostList initialPosts={posts} initialCount={count} />
        </div>

        <aside className="space-y-3 lg:sticky lg:top-[150px] lg:self-start">
          <div className="saramin-section p-4">
            <h2 className="text-base font-black text-gray-900">커뮤니티 바로가기</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <Link href={`${ROUTES.COMMUNITY}?category=news`} className="rounded border border-gray-200 px-3 py-2 font-semibold hover:border-primary hover:text-primary transition-colors">업계뉴스</Link>
              <Link href={`${ROUTES.COMMUNITY}?category=tips`} className="rounded border border-gray-200 px-3 py-2 font-semibold hover:border-primary hover:text-primary transition-colors">노하우공유</Link>
              <Link href={`${ROUTES.COMMUNITY}?category=free`} className="rounded border border-gray-200 px-3 py-2 font-semibold hover:border-primary hover:text-primary transition-colors">자유게시판</Link>
            </div>
          </div>
          <div className="saramin-section p-4">
            <h2 className="text-base font-black text-gray-900">인기 서비스</h2>
            <div className="mt-3 space-y-2 text-sm">
              <Link href={ROUTES.JOBS_NEW} className="btn-outline w-full">채용공고 등록</Link>
              <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-secondary w-full">업체 프로필 등록</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
