'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Pagination from '@/shared/components/Pagination';
import EmptyState from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants';
import { communityService } from '../services/community-service';
import PostCard from './PostCard';
import type { Post } from '@/types/database';

const PAGE_SIZE = 10;

export default function PostList() {
  const searchParams = useSearchParams();

  const category = searchParams.get('category') ?? undefined;
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const [posts, setPosts] = useState<Post[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await communityService.getPosts(
        { category, search },
        page,
        PAGE_SIZE,
      );
      setPosts(result.data);
      setTotalCount(result.count);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [category, search, page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    window.history.pushState(null, '', `?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 w-16 bg-secondary rounded-full mb-3" />
            <div className="h-5 w-3/4 bg-secondary rounded mb-2" />
            <div className="h-4 w-full bg-secondary rounded mb-1" />
            <div className="h-4 w-2/3 bg-secondary rounded mb-4" />
            <div className="flex gap-4">
              <div className="h-3 w-16 bg-secondary rounded" />
              <div className="h-3 w-12 bg-secondary rounded" />
              <div className="h-3 w-12 bg-secondary rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary mb-4">{error}</p>
        <button onClick={fetchPosts} className="btn-outline text-sm">
          다시 시도
        </button>
      </div>
    );
  }

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
      {/* Post Count */}
      <p className="text-sm text-text-muted mb-4">
        총 <span className="font-medium text-text-primary">{totalCount}</span>개의 게시글
      </p>

      {/* Posts */}
      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {/* Pagination */}
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
