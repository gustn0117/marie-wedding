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
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">커뮤니티</h1>
          <p className="text-sm text-gray-500 mt-1">웨딩업계 종사자들과 소통해보세요</p>
        </div>
        <Link href={ROUTES.COMMUNITY_NEW} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          글쓰기
        </Link>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <PostFilters />
      </Suspense>

      {/* List */}
      <PostList initialPosts={posts} initialCount={count} />
    </div>
  );
}
