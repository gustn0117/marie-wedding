'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import SafeImage from '@/shared/components/SafeImage';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';

interface Props {
  profiles: Profile[];
}

/**
 * 메인 '추천 인재·업체 프로필' 카드 캐러셀.
 * - 관리자가 admin/users 에서 지정한 프로필(featured_at IS NOT NULL)만 표시
 * - 금주의 인기공고 캐러셀과 동일한 동작(자동 슬라이드·화살표·호버 정지)
 */
export default function FeaturedProfilesCarousel({ profiles }: Props) {
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
    const step = (card?.offsetWidth ?? 180) + 16;
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
  }, [updateArrows, profiles.length]);

  useEffect(() => {
    if (profiles.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (paused) return;
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        slide(1);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [profiles.length, paused, slide]);

  if (profiles.length === 0) return null;

  return (
    <section className="bg-white pt-10">
      <div
        className="max-w-[1280px] mx-auto px-5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink">추천 인재·업체 프로필</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">관리자가 엄선한 신뢰 프로필</p>
          </div>
          {profiles.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => slide(-1)}
                disabled={!canPrev}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-ink hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="이전 프로필"
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
                aria-label="다음 프로필"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const imageUrl = resolveStorageUrl(profile.profile_image, 'avatars');
  const name = profile.company_name || profile.contact_name || '미상';
  const biz = profile.business_type ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim()) : null;

  return (
    <Link
      href={ROUTES.DIRECTORY_DETAIL(profile.id)}
      data-card
      className="snap-start shrink-0 w-[170px] sm:w-[195px] group"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
        <SafeImage
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          wrapperClassName="w-full h-full"
        />
      </div>
      <div className="mt-2.5">
        <p className="text-[13px] font-bold text-ink leading-snug line-clamp-2 group-hover:underline">{name}</p>
        <p className="text-[10.5px] text-gray-400 mt-1 flex items-center gap-1.5">
          {biz && <span className="truncate">{biz}</span>}
          {biz && <span>·</span>}
          <span className="truncate">{getRegionLabel(profile.region)}</span>
        </p>
      </div>
    </Link>
  );
}
