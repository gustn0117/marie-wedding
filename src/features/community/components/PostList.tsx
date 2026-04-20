'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Pagination from '@/shared/components/Pagination';
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
  const category = searchParams.get('category') ?? undefined;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`?${params.toString()}`);
  };

  if (posts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 py-16 text-center">
        <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-gray-500 mb-1">
          {search ? '검색 결과가 없습니다' : category ? '이 카테고리에 게시글이 없습니다' : '아직 게시글이 없습니다'}
        </p>
        <p className="text-sm text-gray-400 mb-5">
          {search ? '다른 키워드로 검색해보세요' : '첫 게시글을 작성해보세요!'}
        </p>
        <Link href={ROUTES.COMMUNITY_NEW} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          글 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        총 <span className="font-bold text-gray-900">{totalCount.toLocaleString()}</span>건
      </p>

      <div className="space-y-2">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  );
}
