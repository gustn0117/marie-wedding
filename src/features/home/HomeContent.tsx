'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import type { Job, Post, Profile } from '@/types/database';
import EmptyState from '@/shared/components/EmptyState';
import BusinessTypeIcon, { CheckIcon, HandRaisedIcon, SparklesIcon } from '@/shared/components/icons/BusinessTypeIcon';

interface HomeContentProps {
  posts: Post[];
  jobs: Job[];
  profiles: Profile[];
  counts: {
    jobs: number;
    profiles: number;
    posts: number;
    verified: number;
    recentJobs: number;
  };
}

// 카테고리 그리드 — SVG 아이콘 (이모지 사용 금지, 미니멀 무채색 팔레트 준수).
const CATEGORIES: { key: string; label: string; iconKey: string; bg: string }[] = [
  { key: 'venue',     label: '예식장',     iconKey: 'venue',     bg: 'bg-gray-50' },
  { key: 'dress',     label: '드레스샵',   iconKey: 'dress',     bg: 'bg-gray-50' },
  { key: 'studio',    label: '스튜디오',   iconKey: 'studio',    bg: 'bg-gray-50' },
  { key: 'makeup',    label: '메이크업',   iconKey: 'makeup',    bg: 'bg-gray-50' },
  { key: 'planner',   label: '플래너',     iconKey: 'planner',   bg: 'bg-gray-50' },
  { key: 'assistant', label: '예식도우미', iconKey: 'assistant', bg: 'bg-gray-50' },
  { key: 'mc',        label: '사회자',     iconKey: 'mc',        bg: 'bg-gray-50' },
  { key: 'singer',    label: '축가',       iconKey: 'singer',    bg: 'bg-gray-50' },
  { key: 'designer',  label: '디자이너',   iconKey: 'designer',  bg: 'bg-gray-50' },
  { key: '',          label: '전체보기',   iconKey: 'all',       bg: 'bg-gray-100' },
];


export default function HomeContent({ posts, jobs, profiles }: HomeContentProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : ROUTES.JOBS);
  };

  const featuredJobs = useMemo(() => jobs.slice(0, 8), [jobs]);
  const featuredProfiles = useMemo(() => profiles.slice(0, 8), [profiles]);
  const featuredPosts = useMemo(() => posts.slice(0, 6), [posts]);

  return (
    <div className="pb-16">
      {/* Hero — 2단 */}
      <section className="bg-white">
        <div className="max-w-[1280px] mx-auto px-5 pt-12 pb-10">
          <div className="grid lg:grid-cols-[1fr_440px] gap-8 items-start">
            <div className="flex flex-col gap-6 pt-6">
              <h1 className="text-[34px] sm:text-[40px] font-bold leading-[1.2] tracking-tight text-ink">
                일정과 조건에 맞는<br />
                웨딩 파트너를 찾아보세요
              </h1>
              <form onSubmit={handleSearch} className="flex h-14 sm:h-16 overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-sm max-w-[600px]">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="업체명, 직무, 지역을 검색하세요"
                  className="flex-1 min-w-0 px-5 text-[16px] outline-none placeholder:text-gray-400 text-ink"
                />
                <button type="submit" className="bg-white px-5 hover:bg-gray-50 transition-colors">
                  <svg className="w-6 h-6 text-ink" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </button>
              </form>
              <div className="flex flex-wrap gap-2 max-w-[600px]">
                <Link href={`${ROUTES.JOBS}?businessType=planner`} className="hero-chip hero-chip-primary inline-flex items-center gap-1.5">
                  <BusinessTypeIcon type="planner" className="w-4 h-4" /> 플래너 모집
                </Link>
                <Link href={`${ROUTES.JOBS}?type=matching`} className="hero-chip hero-chip-primary inline-flex items-center gap-1.5">
                  <HandRaisedIcon className="w-4 h-4" /> 파트너 섭외
                </Link>
                <Link href={`${ROUTES.JOBS}?businessType=venue`} className="hero-chip">예식장</Link>
                <Link href={`${ROUTES.JOBS}?businessType=studio`} className="hero-chip">스튜디오</Link>
                <Link href={`${ROUTES.JOBS}?businessType=makeup`} className="hero-chip">메이크업</Link>
              </div>
            </div>

            <Link href={`${ROUTES.JOBS}?type=matching`} className="promo-card hidden lg:flex hover:shadow-lg transition-shadow">
              <span className="promo-card-illust">
                <SparklesIcon className="w-12 h-12 text-primary" />
              </span>
              <div className="relative z-10">
                <h3 className="promo-card-title">업체 섭외도<br />한 화면에서</h3>
                <p className="promo-card-desc">지역, 일정, 조건을 빠르게 비교하세요</p>
              </div>
              <span className="promo-card-page">바로 보기 →</span>
            </Link>
          </div>

          {/* 카테고리 아이콘 그리드 */}
          <div className="mt-12 grid grid-cols-5 md:grid-cols-10 gap-2 sm:gap-3">
            {CATEGORIES.map((c) => (
              <Link
                key={c.label}
                href={c.key ? `${ROUTES.JOBS}?businessType=${c.key}` : ROUTES.JOBS}
                className="cat-tile"
              >
                <div className={`cat-tile-icon ${c.bg} text-gray-700`}>
                  <BusinessTypeIcon type={c.iconKey} className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <span className="cat-tile-label">{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* 최근 등록된 공고 — h-scroll 키보드 가이드 + 스크롤 인디케이터 (C-5) */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-[1280px] mx-auto px-5">
          <SectionHeader title="최근 등록된 공고" subtitle="놓치기 아까운 채용·섭외 기회" href={ROUTES.JOBS} />
          {featuredJobs.length === 0 ? (
            <EmptyHint message="아직 등록된 공고가 없습니다." href={ROUTES.JOBS_NEW} cta="공고 등록" />
          ) : (
            <HScrollRow
              ariaLabel="최근 등록된 공고"
              items={featuredJobs}
              renderItem={(job) => <SvcJobCard key={job.id} job={job} />}
            />
          )}
        </div>
      </section>

      {/* 추천 파트너 업체 */}
      {featuredProfiles.length > 0 && (
        <section className="bg-white py-12">
          <div className="max-w-[1280px] mx-auto px-5">
            <SectionHeader title="추천 파트너 업체" subtitle="신뢰할 수 있는 검증 업체 모음" href={ROUTES.DIRECTORY} />
            <HScrollRow
              ariaLabel="추천 파트너 업체"
              items={featuredProfiles}
              renderItem={(p) => <SvcCompanyCard key={p.id} profile={p} />}
            />
          </div>
        </section>
      )}

      {/* 커뮤니티 인기글 */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-[1280px] mx-auto px-5">
          <SectionHeader title="커뮤니티 인기글" subtitle="웨딩 현장의 살아있는 노하우" href={ROUTES.COMMUNITY} />
          {featuredPosts.length === 0 ? (
            <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-sm text-gray-500">첫 글의 주인공이 되어보세요.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {featuredPosts.map((post, idx) => (
                <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                  <span className={`w-7 text-center text-lg font-bold ${idx < 3 ? 'text-primary' : 'text-gray-400'}`}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink line-clamp-1">{post.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">조회 {post.view_count.toLocaleString()} · 좋아요 {post.like_count.toLocaleString()} · {formatRelativeTime(post.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * 가로 스크롤 캐러셀 — 키보드/마우스/터치 모두 지원.
 * 이전: 단순 div.h-scroll — 키보드 사용자에겐 스크롤 방법 가이드 없음, 인디케이터 없음.
 * 수정: aria-label 가진 region role + 좌우 스크롤 버튼.
 *   터치는 native 스와이프, 키보드는 Tab으로 카드 포커스 후 화살표 키 작동.
 */
/**
 * 적응형 카드 그리드.
 * 모바일/태블릿: 가로 스크롤 (정보 밀도 유지).
 * 데스크탑(lg+): 4열 정돈된 그리드 — 카드 사이 명확한 구분.
 */
function HScrollRow<T>({ items, renderItem, ariaLabel }: { items: T[]; renderItem: (item: T) => ReactNode; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 800), behavior: 'smooth' });
  };
  return (
    <div role="region" aria-label={ariaLabel}>
      {/* 모바일·태블릿 — 가로 스크롤 */}
      <div className="relative group lg:hidden">
        <div ref={ref} className="h-scroll" tabIndex={0}>
          {items.map(renderItem)}
        </div>
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="이전"
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center text-ink opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="다음"
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center text-ink opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>
      {/* 데스크탑(lg+) — 4열 그리드 */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-4">
        {items.slice(0, 8).map(renderItem)}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  return (
    <div className="flex items-end justify-between mb-6 pb-4 border-b border-gray-200">
      <div className="min-w-0">
        <h2 className="text-[24px] sm:text-[32px] font-extrabold tracking-tighter text-ink leading-tight">{title}</h2>
        {subtitle && <p className="mt-1.5 text-[14px] text-gray-500">{subtitle}</p>}
      </div>
      <Link href={href} className="shrink-0 inline-flex items-center gap-1 text-[13px] font-bold text-gray-500 hover:text-ink transition-colors">
        전체보기
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </Link>
    </div>
  );
}

function EmptyHint({ message, href, cta }: { message: string; href: string; cta: string }) {
  // C-1/C-10: 공용 EmptyState 컴포넌트로 일관화.
  // 기존 인라인 구현 제거 — 다른 페이지(bookmarks, jobs 등)와 동일한 톤 보장.
  return (
    <EmptyState title={message} description="" actionLabel={cta} actionHref={href} />
  );
}

function SvcJobCard({ job }: { job: Job }) {
  const company = job.author?.company_name || job.author?.contact_name || '업체명 미등록';
  const initial = company.charAt(0).toUpperCase();
  const verified = job.author?.verification_status === 'verified';
  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  const views = job.view_count ?? 0;
  const imageUrl = job.image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-images/${job.image}`
    : null;

  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="svc-card">
      <div className="svc-card-thumb bg-gray-50">
        {isExpired ? (
          <span className="svc-card-badge" style={{ background: '#6b7280' }}>마감</span>
        ) : job.is_promoted ? (
          <span className="svc-card-badge svc-card-badge-promoted">추천</span>
        ) : null}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={job.title} className="svc-card-thumb-img" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold text-gray-300 select-none">{initial}</span>
          </div>
        )}
      </div>
      <div className="svc-card-body">
        {/* 회사 + 직군 메타 (한 줄) */}
        <div className="svc-card-meta-row">
          <span className="truncate">{company}</span>
          {verified && <span className="svc-card-m-badge shrink-0" title="인증 업체">인</span>}
        </div>
        {/* 직무 타이틀 */}
        <p className="svc-card-title">{job.title}</p>
        {/* 메타 — 고용형태·지역 */}
        <div className="svc-card-rating">
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387" /></svg>
            {getEmploymentTypeLabel(job.employment_type)}
          </span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
            {getRegionLabel(job.region)}
          </span>
        </div>
        {/* 급여 */}
        <p className="svc-card-price">{job.salary_info || '면접 후 결정'}</p>
        {/* 푸터 — 조회수 + 마감 */}
        {(views > 0 || job.deadline) && (
          <div className="svc-card-seller justify-between">
            {views > 0 ? (
              <span className="tabular-nums">조회 {views.toLocaleString()}</span>
            ) : <span />}
            {job.deadline && !isExpired && (
              <span className="text-[11px] font-bold text-rose-500 tabular-nums">
                ~ {job.deadline.slice(5, 10).replace('-', '/')}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function SvcCompanyCard({ profile }: { profile: Profile }) {
  const name = profile.company_name || profile.contact_name;
  const initial = name.charAt(0).toUpperCase();
  const verified = profile.verification_status === 'verified';
  const premium = profile.premium_tier !== 'free';
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;
  const deals = profile.completed_deals_count ?? 0;
  const responseRate = Math.round(profile.response_rate ?? 0);
  const isNewBiz = deals === 0;

  return (
    <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="svc-card">
      <div className="svc-card-thumb bg-gray-50">
        {premium ? (
          <span className="svc-card-badge svc-card-badge-prime">PREMIUM</span>
        ) : verified ? (
          <span className="svc-card-badge svc-card-badge-promoted inline-flex items-center gap-0.5"><CheckIcon className="w-3 h-3" /> 인증</span>
        ) : null}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="svc-card-thumb-img" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold text-gray-300 select-none">{initial}</span>
          </div>
        )}
      </div>
      <p className="svc-card-title">{name}</p>
      <div className="svc-card-rating">
        {isNewBiz && responseRate === 0 ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary-50 text-primary text-[10px] font-bold">NEW</span>
        ) : (
          <>
            {deals > 0 && <span className="font-bold text-gray-900">거래 {deals.toLocaleString()}건</span>}
            {responseRate > 0 && <span className="svc-card-rating-count">응답률 {responseRate}%</span>}
          </>
        )}
      </div>
      <p className="svc-card-price">
        {profile.business_type ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim()) : '파트너'} · {getRegionLabel(profile.region)}
      </p>
      <div className="svc-card-seller">
        <span className="truncate flex-1">{profile.contact_name || '담당자'}</span>
        {verified && <span className="svc-card-m-badge" title="인증 업체">인</span>}
      </div>
    </Link>
  );
}
