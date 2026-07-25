import { Suspense } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import PostFilters from '@/features/community/components/PostFilters';
import PostList from '@/features/community/components/PostList';
import type { Post } from '@/types/database';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';
import PageHeader from '@/shared/components/PageHeader';
import LoadErrorState from '@/shared/components/LoadErrorState';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { toPlainText } from '@/shared/seo';

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

async function getPosts(searchParams: Record<string, string | undefined>, isAuthenticated: boolean) {
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

  if (searchParams.category) {
    query = query.eq('category', searchParams.category);
  }
  if (searchParams.search) {
    const term = normalizeSearchTerm(searchParams.search);
    if (term) {
      query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
    }
  }

  // 공지글은 항상 최상단 고정
  query = query.order('is_notice', { ascending: false });

  // 정렬 옵션
  if (sort === 'popular') {
    query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(from, to);

  const { data, count, error } = await query;

  // 비로그인에는 본문 전체를 보내지 않는다. 글 상세가 로그인 필수인데 목록 페이로드에
  // 원문이 실려 있으면 소스만 봐도 다 읽히므로, 카드 미리보기에 필요한 만큼만 남긴다.
  // 공지는 비로그인에도 전체 공개라 그대로 둔다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (data ?? []).map((row: any) => {
    const { comments: commentAgg, ...rest } = row;
    const post = { ...rest, comment_count: commentAgg?.[0]?.count ?? 0 } as Post;
    if (!isAuthenticated && !post.is_notice) {
      post.content = toPlainText(post.content, 150);
    }
    return post;
  });

  return { posts, count: count ?? 0, error: !!error };
}

export default async function CommunityPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const viewer = await getCurrentVerifiedProfile();
  const { posts, count, error } = await getPosts(resolvedSearchParams, viewer.ok);
  const activeFilterCount = ['category', 'search', 'sort'].filter((key) => resolvedSearchParams[key]).length;

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

      <Suspense fallback={null}>
        <PostFilters />
      </Suspense>
      {error ? (
        <LoadErrorState message="게시글을 불러오지 못했습니다." />
      ) : (
        <PostList initialPosts={posts} initialCount={count} />
      )}
    </div>
  );
}
