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

  let query = supabase
    .from('posts')
    .select('*, author:profiles!author_id(*), comments:comments(count)', { count: 'exact' })
    .is('deleted_at', null);

  if (searchParams.category) {
    query = query.eq('category', searchParams.category);
  }
  if (searchParams.search) {
    query = query.or(`title.ilike.%${searchParams.search}%,content.ilike.%${searchParams.search}%`);
  }

  query = query.order('created_at', { ascending: false }).range(from, to);

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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">커뮤니티</h1>
          <p className="text-sm text-text-secondary mt-1">웨딩업계 종사자들과 소통해보세요</p>
        </div>
        <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary text-sm">글 작성</Link>
      </div>

      <Suspense fallback={null}>
        <PostFilters />
      </Suspense>

      <div className="mt-6">
        <PostList initialPosts={posts} initialCount={count} />
      </div>
    </div>
  );
}
