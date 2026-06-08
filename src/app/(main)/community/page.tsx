import { Suspense } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import PostFilters from '@/features/community/components/PostFilters';
import PostList from '@/features/community/components/PostList';
import HotPostsSection from '@/features/community/components/HotPostsSection';
import type { Post } from '@/types/database';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';
import PageHeader from '@/shared/components/PageHeader';

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
  if (searchParams.region) {
    query = query.eq('region', searchParams.region);
  }
  if (searchParams.search) {
    const term = normalizeSearchTerm(searchParams.search);
    if (term) {
      query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
    }
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
  const activeFilterCount = ['category', 'search', 'sort', 'region'].filter((key) => searchParams[key]).length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="커뮤니티"
        title="커뮤니티"
        description={`현장 노하우·업계 소식·구인 경험을 나누는 실무 지식 공간 · 게시글 ${count.toLocaleString()}건 · 선택 조건 ${activeFilterCount}개`}
        actions={
          <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary text-sm">+ 글쓰기</Link>
        }
      />

      <HotPostsSection />
      <Suspense fallback={null}>
        <PostFilters />
      </Suspense>
      <PostList initialPosts={posts} initialCount={count} />
    </div>
  );
}
