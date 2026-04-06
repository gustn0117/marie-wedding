'use client';

import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import {
  formatRelativeTime,
  getCategoryLabel,
} from '@/shared/utils/format';
import type { Post } from '@/types/database';

const getBusinessIcon = (type: string) => {
  const icons: Record<string, string> = {
    venue: '🏛️', dress: '👗', studio: '📸', makeup: '💄',
    planner: '📋', assistant: '🤝', other: '📦',
  };
  return icons[type] || '📦';
};

interface HomeContentProps {
  posts: Post[];
}

export default function HomeContent({ posts }: HomeContentProps) {
  return (
    <>
      {/* FULL-WIDTH BANNER */}
      <section className="bg-gradient-to-r from-primary-dark via-primary to-primary-dark">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="bg-white text-primary text-xs font-bold px-2.5 py-1 rounded">Marié</span>
            <p className="text-white font-bold text-[15px] sm:text-lg">
              웨딩업계 인재를 찾고 계신가요? <span className="text-primary-200 hidden sm:inline">지금 무료로 공고를 등록하세요</span>
            </p>
          </div>
          <Link
            href={ROUTES.JOBS_NEW}
            className="shrink-0 bg-white text-primary text-sm font-semibold px-4 py-2 rounded hover:bg-gray-100 transition-colors"
          >
            공고 등록 &rarr;
          </Link>
        </div>
      </section>

      {/* CATEGORY BROWSE */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-[16px] font-bold text-gray-900">업종별 채용</h2>
                <Link href={ROUTES.JOBS} className="text-[12px] text-gray-400 hover:text-primary transition-colors">더보기</Link>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-4 gap-3">
                  {BUSINESS_TYPES.map((type) => (
                    <Link
                      key={type.value}
                      href={`${ROUTES.JOBS}?business=${type.value}`}
                      className="flex flex-col items-center gap-2 py-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <span className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary text-lg group-hover:bg-primary group-hover:text-white transition-colors">
                        {getBusinessIcon(type.value)}
                      </span>
                      <span className="text-[12px] font-medium text-gray-600 group-hover:text-primary">{type.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-[16px] font-bold text-gray-900">지역별 채용</h2>
                <Link href={ROUTES.JOBS} className="text-[12px] text-gray-400 hover:text-primary transition-colors">더보기</Link>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map((region) => (
                    <Link
                      key={region.value}
                      href={`${ROUTES.JOBS}?region=${region.value}`}
                      className="px-3.5 py-2 text-[13px] text-gray-600 bg-gray-50 rounded hover:bg-primary-50 hover:text-primary transition-colors font-medium border border-gray-100 hover:border-primary-200"
                    >
                      {region.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMMUNITY SECTION */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-bold text-gray-900">커뮤니티</h2>
            <Link href={ROUTES.COMMUNITY} className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
              더보기 &rarr;
            </Link>
          </div>
          {posts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={ROUTES.COMMUNITY_DETAIL(post.id)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-primary bg-primary-50 px-2 py-0.5 rounded">{getCategoryLabel(post.category)}</span>
                    <span className="text-[11px] text-gray-400">{formatRelativeTime(post.created_at)}</span>
                  </div>
                  <h3 className="text-[14px] font-semibold text-gray-800 group-hover:text-primary transition-colors mb-1.5 line-clamp-1">
                    {post.title}
                  </h3>
                  <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed">
                    {post.content}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-[12px] text-gray-400">
                    <span>조회 {post.view_count}</span>
                    {post.comment_count !== undefined && post.comment_count > 0 && (
                      <>
                        <span>·</span>
                        <span>댓글 {post.comment_count}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

    </>
  );
}
