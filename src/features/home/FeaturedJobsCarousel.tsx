'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';

interface Props {
  jobs: Job[];
}

/**
 * 메인 페이지 '금주의 인기공고' 캐러셀.
 * - 관리자가 admin/jobs에서 선정한 jobs (featured_at IS NOT NULL)만 표시
 * - 자동 슬라이드 (4초 간격, 1카드씩)
 * - 좌우 화살표, 호버 시 일시정지, 마우스 휠/드래그 스크롤 지원
 * - prefers-reduced-motion 존중
 */
export default function FeaturedJobsCarousel({ jobs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const slide = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLAnchorElement>('[data-card]');
    const step = (card?.offsetWidth ?? 180) + 16; // gap-4 = 16px
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, jobs.length]);

  // 자동 슬라이드
  useEffect(() => {
    if (jobs.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (paused) return;

    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      // 끝에 도달했으면 처음으로 부드럽게 점프
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        slide(1);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [paused, jobs.length, slide]);

  if (jobs.length === 0) return null;

  return (
    <section
      className="bg-white border-y border-gray-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="shell-wide py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink">금주의 인기공고</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">관리자가 엄선한 추천 공고</p>
          </div>
          {jobs.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => slide(-1)}
                disabled={!canPrev}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-ink hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="이전 공고"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => slide(1)}
                disabled={!canNext}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-ink hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="다음 공고"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Cards row */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollPaddingLeft: '0px' }}
        >
          {jobs.map((job) => (
            <FeaturedCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCard({ job }: { job: Job }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const imageUrl = job.image
    ? `${supabaseUrl}/storage/v1/object/public/job-images/${job.image}`
    : null;

  const dDay = (() => {
    if (!job.deadline) return null;
    const ms = new Date(job.deadline).getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days < 0) return '마감';
    if (days === 0) return 'D-Day';
    return `D-${days}`;
  })();

  const companyLabel = job.author?.company_name || job.author?.contact_name || '미상';

  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      data-card
      className="snap-start shrink-0 w-[160px] sm:w-[180px] group"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={job.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
            </svg>
          </div>
        )}
        {/* 우상단 뱃지 — 조회수 */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/65 backdrop-blur-sm text-white text-[10px] font-bold rounded-full px-2 py-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="tabular-nums">{job.view_count.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-2.5">
        <p className="text-[13px] font-bold text-ink leading-snug line-clamp-2 group-hover:underline">{job.title}</p>
        <p className="text-[11px] text-gray-500 mt-1 truncate">{companyLabel}</p>
        <p className="text-[10.5px] text-gray-400 mt-1 flex items-center gap-1.5 tabular-nums">
          {dDay && <span>{dDay}</span>}
          {dDay && <span>·</span>}
          <span className="truncate">{getBusinessTypeLabel(job.business_type)}</span>
          <span>·</span>
          <span className="truncate">{getRegionLabel(job.region)}</span>
        </p>
      </div>
    </Link>
  );
}
