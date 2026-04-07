'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import {
  getEmploymentTypeLabel,
  getRegionLabel,
  formatRelativeTime,
  getCategoryLabel,
} from '@/shared/utils/format';
import type { Job, Post } from '@/types/database';

interface MyPageTabsProps {
  jobs: Job[];
  posts: Post[];
}

export default function MyPageTabs({ jobs, posts }: MyPageTabsProps) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'posts'>('jobs');

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex-1 px-5 py-3.5 text-sm font-semibold transition-colors ${
              activeTab === 'jobs' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            내 공고 ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 px-5 py-3.5 text-sm font-semibold transition-colors ${
              activeTab === 'posts' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            내 게시글 ({posts.length})
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'jobs' ? (
          jobs.length === 0 ? (
            <div className="text-center py-10">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <p className="text-sm text-gray-400 mb-4">등록한 공고가 없습니다.</p>
              <Link href={ROUTES.JOBS_NEW} className="btn-primary text-sm">공고 등록하기</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <Link key={job.id} href={ROUTES.JOBS_DETAIL(job.id)} className="flex items-center justify-between gap-3 py-3.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {job.is_urgent && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">긴급</span>}
                      <h3 className="text-sm font-medium text-gray-800 group-hover:text-primary transition-colors truncate">{job.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                      <span>·</span>
                      <span>{getRegionLabel(job.region)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(job.created_at)}</span>
                </Link>
              ))}
            </div>
          )
        ) : (
          posts.length === 0 ? (
            <div className="text-center py-10">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-sm text-gray-400 mb-4">작성한 게시글이 없습니다.</p>
              <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary text-sm">글 작성하기</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {posts.map((post) => (
                <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="flex items-center justify-between gap-3 py-3.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-primary bg-primary-50 px-1.5 py-0.5 rounded">{getCategoryLabel(post.category)}</span>
                      <h3 className="text-sm font-medium text-gray-800 group-hover:text-primary transition-colors truncate">{post.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>조회 {post.view_count}</span>
                      {post.comment_count !== undefined && post.comment_count > 0 && (
                        <>
                          <span>·</span>
                          <span>댓글 {post.comment_count}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(post.created_at)}</span>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
