'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import {
  getEmploymentTypeLabel,
  getRegionLabel,
  formatRelativeTime,
  getCategoryLabel,
} from '@/shared/utils/format';
import type { Application, ApplicationStatus, Job, Post } from '@/types/database';
import { APPLICATION_STATUS_LABELS } from '@/features/applications/services/application-service';
import JobStatusMenu from '@/features/jobs/components/JobStatusMenu';
import { reviewWindowOpen } from '@/features/applications/lib/reviewWindow';
import { JOB_STATUS_LABELS } from '@/shared/constants';

type AppFilter = 'all' | 'active' | 'completed' | ApplicationStatus;

const APP_FILTERS: { value: AppFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행중' },
  { value: 'pending', label: '접수' },
  { value: 'reviewing', label: '검토중' },
  { value: 'accepted', label: '승인' },
  { value: 'completed', label: '진행완료' },
  { value: 'rejected', label: '거절' },
  { value: 'cancelled', label: '취소' },
];

interface MyPageTabsProps {
  accountType: 'business' | 'individual';
  jobs: Job[];
  posts: Post[];
  sentApplications: Application[];
  receivedApplications: Application[];
}

export default function MyPageTabs({ accountType, jobs: initialJobs, posts, sentApplications, receivedApplications }: MyPageTabsProps) {
  const isBusiness = accountType === 'business';
  const [activeTab, setActiveTab] = useState<'jobs' | 'posts' | 'applications'>(isBusiness ? 'jobs' : 'applications');
  const [jobs, setJobs] = useState(initialJobs);
  const applicationCount = sentApplications.length + receivedApplications.length;

  // QA-012: 통계 카드 클릭 → URL ?tab= → 해당 탭 자동 선택 + 스크롤.
  // App Router의 soft navigation(history.pushState)은 hashchange를 발생시키지 않으므로
  // 해시 대신 searchParams를 구독해야 같은 페이지 내 카드 클릭에도 반응한다.
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    const valid = tabParam === 'jobs' || tabParam === 'posts' || tabParam === 'applications';
    // 유효 tab 파라미터가 없거나(뒤로가기로 /mypage 복귀) 개인계정에 jobs 요청이면 기본 탭으로 복귀.
    // 예전엔 early-return 이라 ?tab=posts → 뒤로가기 시 URL 은 /mypage 인데 탭이 posts 로 남아
    // 새로고침해야 맞춰졌다. URL 변화에 항상 반응하도록 리셋 분기를 둔다(리셋 시엔 스크롤 안 함).
    if (!valid || (tabParam === 'jobs' && !isBusiness)) {
      setActiveTab(isBusiness ? 'jobs' : 'applications');
      return;
    }
    setActiveTab(tabParam);
    const el = document.getElementById('mypage-tabs');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isBusiness, tabParam]);

  // 직접 URL 진입(/mypage#received-applications 등 레거시 해시) 마운트 1회 처리.
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    let next: 'jobs' | 'posts' | 'applications' | null = null;
    if (hash === '#registered-jobs' && isBusiness) next = 'jobs';
    else if (hash === '#my-posts') next = 'posts';
    else if (hash === '#sent-applications' || hash === '#received-applications') next = 'applications';
    if (next) {
      setActiveTab(next);
      const el = document.getElementById('mypage-tabs');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isBusiness]);

  return (
    <div id="mypage-tabs" className="platform-panel scroll-mt-20">
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto bg-white">
          {isBusiness && (
            <button
              onClick={() => setActiveTab('jobs')}
              className={`min-w-[150px] flex-1 px-5 py-3.5 text-sm font-bold transition-colors ${
                activeTab === 'jobs' ? 'bg-white text-ink border-b-2 border-ink' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              내 공고 ({jobs.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab('posts')}
            className={`min-w-[150px] flex-1 px-5 py-3.5 text-sm font-bold transition-colors ${
              activeTab === 'posts' ? 'bg-white text-ink border-b-2 border-ink' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            내 게시글 ({posts.length})
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`min-w-[150px] flex-1 px-5 py-3.5 text-sm font-bold transition-colors ${
              activeTab === 'applications' ? 'bg-white text-ink border-b-2 border-ink' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            지원 ({applicationCount})
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
              {jobs.map((job) => {
                const receivedForThis = receivedApplications.filter((a) => a.job_id === job.id);
                const pendingCount = receivedForThis.filter((a) => a.status === 'pending' || a.status === 'reviewing').length;
                return (
                  <div key={job.id} className="platform-data-row group block rounded px-3 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={ROUTES.JOBS_DETAIL(job.id)} className="min-w-0 flex-1 block">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {(job.status === 'closed' || job.status === 'filled' || job.status === 'hidden') && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              job.status === 'filled' ? 'bg-primary text-white'
                                : job.status === 'hidden' ? 'bg-gray-200 text-gray-600'
                                : 'bg-gray-100 text-gray-500'
                            }`}>{JOB_STATUS_LABELS[job.status]}</span>
                          )}
                          {job.status === 'urgent' && <span className="badge-urgent">마감임박</span>}
                          <h3 className="text-sm font-bold text-gray-800 group-hover:text-primary transition-colors truncate">{job.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                          <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                          <span>·</span>
                          <span>{getRegionLabel(job.region)}</span>
                          {receivedForThis.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="font-bold text-gray-700">지원 {receivedForThis.length}{pendingCount > 0 ? ` (검토 ${pendingCount})` : ''}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{formatRelativeTime(job.created_at)}</span>
                        </div>
                      </Link>
                      <JobStatusMenu
                        job={job}
                        onChange={(updated) => setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === 'posts' ? (
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
                <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="platform-data-row group flex items-center justify-between gap-3 rounded px-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-primary bg-primary-50 px-1.5 py-0.5 rounded">{getCategoryLabel(post.category)}</span>
                      <h3 className="text-sm font-bold text-gray-800 group-hover:text-primary transition-colors truncate">{post.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {post.comment_count !== undefined && post.comment_count > 0 && (
                        <span>댓글 {post.comment_count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(post.created_at)}</span>
                </Link>
              ))}
            </div>
          )
        ) : (
          <div className={`grid gap-5 ${isBusiness ? 'lg:grid-cols-2' : ''}`}>
            {isBusiness && <FilterableApplicationList title="받은 지원" empty="내 공고에 접수된 지원이 없습니다." items={receivedApplications} mode="received" />}
            <FilterableApplicationList title="보낸 지원" empty="아직 지원한 공고가 없습니다." items={sentApplications} mode="sent" />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterableApplicationList({
  title,
  empty,
  items,
  mode,
}: {
  title: string;
  empty: string;
  items: Application[];
  mode: 'sent' | 'received';
}) {
  const [filter, setFilter] = useState<AppFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'active') return items.filter((a) => a.status === 'pending' || a.status === 'reviewing');
    if (filter === 'completed') return items.filter((a) => a.hiring_completed_at && a.applicant_completed_at);
    return items.filter((a) => a.status === filter);
  }, [items, filter]);

  return (
    <section className="rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-secondary-50 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-gray-900">{title} <span className="text-primary">{filtered.length}</span><span className="text-gray-400">/{items.length}</span></h3>
      </div>
      <div className="border-b border-gray-100 px-3 py-2 flex items-center gap-1 overflow-x-auto">
        {APP_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded border px-2.5 py-1 text-xs font-bold transition-colors ${
              filter === f.value
                ? 'border-primary bg-primary text-white'
                : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-gray-400">
          {items.length === 0 ? empty : '해당 상태의 항목이 없습니다.'}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map((item) => {
            // Link 안에 Link 중첩은 HTML 스펙(§13.2.6.4.7) 위반.
            // 브라우저 파서가 outer anchor를 강제 종료하면서 클릭 핸들러가 두 곳 부착되어
            // 1클릭에 다중 네비게이션이 발생함. outer 카드는 div + 단일 내부 Link로 구성.
            // QA-013: 받은 지원 카드 클릭 시 application 상세로 이동 (job 상세로 이동하던 기존 동작 교체)
            const cardHref = `/applications/${item.id}`;
            // 30일 창이 지나면 리뷰 제출이 거부되므로 링크도 숨긴다.
            const showReviewLink = reviewWindowOpen(item.hiring_completed_at, item.applicant_completed_at);
            return (
              <div key={item.id} className="platform-data-row relative px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* 카드 전체 클릭 영역 — pseudo overlay로 안전하게. inner Link보다 낮은 z. */}
                    <Link href={cardHref} className="absolute inset-0 z-0" aria-label={item.job?.title ?? '공고 보기'} />
                    <p className="relative z-[1] truncate text-sm font-bold text-gray-900">
                      {item.job?.title ?? '공고'}
                    </p>
                    <p className="relative z-[1] mt-1 text-xs text-gray-500">
                      {mode === 'received'
                        ? item.applicant?.company_name || item.applicant?.contact_name || '지원자'
                        : item.job?.author?.company_name || item.job?.author?.contact_name || '작성자'}
                    </p>
                    <p className="relative z-[1] mt-1 line-clamp-2 text-xs text-gray-400">{item.message}</p>
                  </div>
                  <div className="relative z-[1] shrink-0 text-right">
                    <span className="badge-attr">{APPLICATION_STATUS_LABELS[item.status]}</span>
                    {showReviewLink && (
                      <Link
                        href={`/applications/${item.id}/review`}
                        className="mt-1 block text-[10px] font-bold text-primary underline"
                      >
                        <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>진행 완료 · 리뷰 작성
                      </Link>
                    )}
                    <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(item.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
