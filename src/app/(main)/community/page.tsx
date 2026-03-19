import { Suspense } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import PostFilters from '@/features/community/components/PostFilters';
import PostList from '@/features/community/components/PostList';

export const metadata = {
  title: '커뮤니티 | 마리에',
  description: '웨딩업계 종사자들의 커뮤니티. 업계뉴스, 노하우 공유, 자유게시판.',
};

export default function CommunityPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            커뮤니티
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            웨딩업계 종사자들과 소통해보세요
          </p>
        </div>
        <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary text-sm">
          글 작성
        </Link>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <PostFilters />
      </Suspense>

      {/* Post List */}
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-4 w-16 bg-secondary rounded-full mb-3" />
                  <div className="h-5 w-3/4 bg-secondary rounded mb-2" />
                  <div className="h-4 w-full bg-secondary rounded" />
                </div>
              ))}
            </div>
          }
        >
          <PostList />
        </Suspense>
      </div>
    </div>
  );
}
