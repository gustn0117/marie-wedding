'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import {
  getEmploymentTypeLabel,
  getRegionLabel,
  formatRelativeTime,
  getCategoryLabel,
} from '@/shared/utils/format';
import type { Job, Post } from '@/types/database';

const toolButtons = [
  { icon: '📝', label: '공고 등록', href: ROUTES.JOBS_NEW },
  { icon: '🔍', label: '맞춤 채용', href: ROUTES.JOBS },
  { icon: '🏢', label: '업체 찾기', href: ROUTES.DIRECTORY },
];

const sideNavItems = [
  { label: '추천공고', href: ROUTES.JOBS },
  { label: '주요 채용소식', href: ROUTES.JOBS },
  { label: '업체정보', href: ROUTES.DIRECTORY },
  { label: '커뮤니티', href: ROUTES.COMMUNITY },
];

const centerTabs = [
  { key: 'recommend', label: '최신 채용 공고', icon: '✨' },
  { key: 'hot', label: '지금 핫한 채용 공고', icon: '🔥' },
  { key: 'urgent', label: '업체 섭외 공고', icon: '⚡' },
];

const getBusinessIcon = (type: string) => {
  const icons: Record<string, string> = {
    venue: '🏛️', dress: '👗', studio: '📸', makeup: '💄',
    planner: '📋', assistant: '🤝', other: '📦',
  };
  return icons[type] || '📦';
};

interface HomeContentProps {
  jobs: Job[];
  matchingJobs: Job[];
  posts: Post[];
}

export default function HomeContent({ jobs, matchingJobs, posts }: HomeContentProps) {
  const [activeTab, setActiveTab] = useState('recommend');

  const urgentJobs = jobs.filter((j) => j.is_urgent).slice(0, 4);
  const displayJobs = activeTab === 'urgent' ? matchingJobs : activeTab === 'hot' ? urgentJobs : jobs;

  return (
    <>
      {/* MAIN 3-COLUMN SECTION */}
      <section className="bg-white">
        <div className="max-w-[1200px] mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-[18px] font-bold text-gray-900">오늘의 웨딩업계 소식</h2>
          </div>

          <div className="flex gap-5">
            {/* Center Column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center border-b border-gray-200 mb-0">
                {centerTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'text-primary border-primary'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {displayJobs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border border-gray-200 rounded-b-lg overflow-hidden">
                  {displayJobs.map((job, idx) => (
                    <Link
                      key={job.id}
                      href={ROUTES.JOBS_DETAIL(job.id)}
                      className={`flex flex-col p-5 hover:bg-blue-50/40 transition-colors group ${
                        idx < displayJobs.length - 1 ? 'border-r border-b border-gray-100' : ''
                      }`}
                    >
                      <div className="text-3xl mb-3">{getBusinessIcon(job.business_type)}</div>
                      <h3 className="text-[14px] font-semibold text-gray-800 group-hover:text-primary transition-colors leading-snug mb-2 line-clamp-2">
                        {job.title}
                      </h3>
                      <p className="text-[13px] text-gray-500 mb-auto">{job.author?.company_name || '알 수 없음'}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[12px] text-gray-400">{getRegionLabel(job.region)}</span>
                        <span className="text-[12px] text-gray-300">·</span>
                        <span className="text-[12px] text-gray-400">{getEmploymentTypeLabel(job.employment_type)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="hidden xl:block w-[280px] shrink-0 space-y-4">
              <div className="bg-gradient-to-br from-primary to-primary-dark rounded-xl p-5 text-white relative overflow-hidden">
                <span className="absolute top-3 left-3 text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">이벤트</span>
                <div className="pt-5">
                  <h3 className="text-[18px] font-bold leading-tight mb-1">무료 공고 등록</h3>
                  <p className="text-[13px] text-primary-200 mb-3">지금 공고 등록하면<br />첫 달 무료!</p>
                </div>
              </div>

              <div className="flex gap-2">
                {toolButtons.map((tool) => (
                  <Link
                    key={tool.label}
                    href={tool.href}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
                  >
                    <span className="text-xl">{tool.icon}</span>
                    <span className="text-[11px] font-medium text-gray-600">{tool.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Floating Side Nav */}
          <div className="hidden 2xl:fixed 2xl:block right-[calc((100vw-1200px)/2-80px)] top-[200px] w-[68px]">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {sideNavItems.map((item, idx) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block px-2 py-2.5 text-[11px] text-center text-gray-500 hover:text-primary hover:bg-gray-50 transition-colors ${
                    idx < sideNavItems.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="block w-full px-2 py-2.5 text-[11px] text-center text-gray-400 hover:text-primary border-t border-gray-100 transition-colors"
              >
                TOP
              </button>
            </div>
          </div>
        </div>
      </section>

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

      {/* RECOMMENDED JOBS */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-bold text-gray-900">
              회원님이 꼭 봐야 할 공고
              <span className="text-primary ml-1.5 text-[13px] font-semibold">(추천)</span>
            </h2>
            <Link href={ROUTES.JOBS} className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
              더보기 &rarr;
            </Link>
          </div>

          {jobs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {jobs.slice(0, 4).map((job) => (
                <Link
                  key={job.id}
                  href={ROUTES.JOBS_DETAIL(job.id)}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <div className="bg-gray-50 flex items-center justify-center py-8 border-b border-gray-100">
                    <span className="text-5xl">{getBusinessIcon(job.business_type)}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-[14px] font-semibold text-gray-800 group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-1.5">
                      {job.title}
                    </h3>
                    <p className="text-[13px] text-gray-500">{job.author?.company_name || '알 수 없음'}</p>
                    <p className="text-[12px] text-gray-400 mt-2">
                      {getRegionLabel(job.region)} · {getEmploymentTypeLabel(job.employment_type)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
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
