'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Pagination from '@/shared/components/Pagination';
import EmptyState from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants';
import PostCard from './PostCard';
import type { Post } from '@/types/database';

const PAGE_SIZE = 10;

interface PostListProps {
  initialPosts?: Post[];
  initialCount?: number;
}

export default function PostList({ initialPosts, initialCount }: PostListProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const posts = initialPosts ?? [];
  const totalCount = initialCount ?? 0;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const search = searchParams.get('search') ?? undefined;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`?${params.toString()}`);
  };

  if (posts.length === 0) {
    return (
      <EmptyState
        title="게시글이 없습니다"
        description={
          search
            ? '검색 결과가 없습니다. 다른 키워드로 검색해보세요.'
            : '아직 등록된 게시글이 없습니다. 첫 게시글을 작성해보세요!'
        }
        actionLabel="글 작성하기"
        actionHref={ROUTES.COMMUNITY_NEW}
      />
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-400 mb-4">
        총 <span className="font-medium text-gray-900">{totalCount}</span>개의 게시글
      </p>

      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
