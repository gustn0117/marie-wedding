'use client';

import { useMemo, useState } from 'react';
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
  mySidebar?: React.ReactNode;
}

const CATEGORIES: { key: string; label: string; icon: string; bg: string }[] = [
  { key: 'venue',     label: '예식장',     icon: '🏰', bg: 'bg-gray-50' },
  { key: 'dress',     label: '드레스샵',   icon: '👗', bg: 'bg-gray-50' },
  { key: 'studio',    label: '스튜디오',   icon: '📸', bg: 'bg-gray-50' },
  { key: 'makeup',    label: '메이크업',   icon: '💄', bg: 'bg-gray-50' },
  { key: 'planner',   label: '플래너',     icon: '📋', bg: 'bg-primary-50' },
  { key: 'assistant', label: '예식도우미', icon: '🎀', bg: 'bg-gray-50' },
  { key: 'mc',        label: '사회자',     icon: '🎤', bg: 'bg-gray-50' },
  { key: 'singer',    label: '축가',       icon: '🎵', bg: 'bg-gray-50' },
  { key: 'designer',  label: '디자이너',   icon: '✏️', bg: 'bg-gray-50' },
  { key: '',          label: '전체보기',   icon: '⊞', bg: 'bg-gray-100' },
];

const GRADIENTS = [
  'from-gray-50 to-gray-100',
  'from-gray-100 to-gray-50',
  'from-primary-50 to-gray-100',
  'from-gray-50 to-primary-50',
];
const EMOJIS = ['💍', '👗', '📸', '💄', '📋', '🎀', '🎤', '🎵'];

export default function HomeContent({ posts, jobs, profiles, counts, mySidebar }: HomeContentProps) {
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
              <h1 className="text-[34px] sm:text-[40px] font-extrabold leading-[1.2] tracking-tight text-ink">
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
                  <span className="text-base">📋</span> 플래너 모집
                </Link>
                <Link href={`${ROUTES.JOBS}?type=matching`} className="hero-chip hero-chip-primary inline-flex items-center gap-1.5">
                  <span className="text-base">🤝</span> 파트너 섭외
                </Link>
                <Link href={`${ROUTES.JOBS}?businessType=venue`} className="hero-chip">예식장</Link>
                <Link href={`${ROUTES.JOBS}?businessType=studio`} className="hero-chip">스튜디오</Link>
                <Link href={`${ROUTES.JOBS}?businessType=makeup`} className="hero-chip">메이크업</Link>
              </div>
            </div>

            <Link href={`${ROUTES.JOBS}?type=matching`} className="promo-card hidden lg:flex hover:shadow-lg transition-shadow">
              <span className="promo-card-illust">💍</span>
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
                <div className={`cat-tile-icon ${c.bg}`}>{c.icon}</div>
                <span className="cat-tile-label">{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 내 패널 (로그인 시) */}
      {mySidebar && (
        <div className="max-w-[1280px] mx-auto px-5">
          {mySidebar}
        </div>
      )}

      {/* 최근 등록된 공고 */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-[1280px] mx-auto px-5">
          <SectionHeader title="최근 등록된 공고" subtitle="놓치기 아까운 채용·섭외 기회" href={ROUTES.JOBS} />
          {featuredJobs.length === 0 ? (
            <EmptyHint message="아직 등록된 공고가 없습니다." href={ROUTES.JOBS_NEW} cta="공고 등록" />
          ) : (
            <div className="h-scroll">
              {featuredJobs.map((job, idx) => <SvcJobCard key={job.id} job={job} idx={idx} />)}
            </div>
          )}
        </div>
      </section>

      {/* 추천 파트너 업체 */}
      {featuredProfiles.length > 0 && (
        <section className="bg-white py-12">
          <div className="max-w-[1280px] mx-auto px-5">
            <SectionHeader title="추천 파트너 업체" subtitle="신뢰할 수 있는 검증 업체 모음" href={ROUTES.DIRECTORY} />
            <div className="h-scroll">
              {featuredProfiles.map((p, idx) => <SvcCompanyCard key={p.id} profile={p} idx={idx} />)}
            </div>
          </div>
        </section>
      )}

      {/* 커뮤니티 + 지표 */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-[1280px] mx-auto px-5 grid lg:grid-cols-[2fr_1fr] gap-8">
          <div>
            <SectionHeader title="커뮤니티 인기글" subtitle="웨딩 현장의 살아있는 노하우" href={ROUTES.COMMUNITY} />
            {featuredPosts.length === 0 ? (
              <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-12 text-center">
                <p className="text-sm text-gray-500">첫 글의 주인공이 되어보세요.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {featuredPosts.map((post, idx) => (
                  <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                    <span className={`w-7 text-center text-lg font-extrabold ${idx < 3 ? 'text-primary' : 'text-gray-400'}`}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink line-clamp-1">{post.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">조회 {post.view_count.toLocaleString()} · 좋아요 {post.like_count.toLocaleString()} · {formatRelativeTime(post.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside>
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">실시간 지표</p>
              <div className="space-y-4">
                <Metric label="인증 업체" value={counts.verified} />
                <Metric label="최근 30일 공고" value={counts.recentJobs} divider />
                <Metric label="활성 파트너" value={counts.profiles} divider />
              </div>
              <Link href={ROUTES.SIGNUP} className="btn-primary w-full justify-center mt-6">지금 무료로 시작</Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, divider }: { label: string; value: number; divider?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${divider ? 'pt-4 border-t border-gray-100' : ''}`}>
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-xl font-extrabold text-ink tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <Link href={href} className="text-sm font-bold text-gray-500 hover:text-ink transition-colors">전체보기 →</Link>
    </div>
  );
}

function EmptyHint({ message, href, cta }: { message: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-12 text-center">
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      <Link href={href} className="btn-primary inline-flex">{cta}</Link>
    </div>
  );
}

function SvcJobCard({ job, idx }: { job: Job; idx: number }) {
  const g = GRADIENTS[idx % GRADIENTS.length];
  const emoji = EMOJIS[idx % EMOJIS.length];
  const company = job.author?.company_name || job.author?.contact_name || '업체명 미등록';
  const verified = job.author?.verification_status === 'verified';
  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  const views = job.view_count ?? 0;

  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="svc-card">
      <div className={`svc-card-thumb bg-gradient-to-br ${g}`}>
        {isExpired ? (
          <span className="svc-card-badge" style={{ background: '#6b7280' }}>마감</span>
        ) : job.is_promoted ? (
          <span className="svc-card-badge svc-card-badge-promoted">추천</span>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-40">{emoji}</div>
      </div>
      <p className="svc-card-title">{job.title}</p>
      <div className="svc-card-rating">
        <span className="font-bold text-gray-900">조회 {views.toLocaleString()}</span>
        <span className="svc-card-rating-count">{getEmploymentTypeLabel(job.employment_type)} · {getRegionLabel(job.region)}</span>
      </div>
      <p className="svc-card-price">{job.salary_info || '면접 후 결정'}</p>
      <div className="svc-card-seller">
        <span className="truncate flex-1">{company}</span>
        {verified && <span className="svc-card-m-badge">인</span>}
      </div>
    </Link>
  );
}

function SvcCompanyCard({ profile, idx }: { profile: Profile; idx: number }) {
  const g = GRADIENTS[(idx + 3) % GRADIENTS.length];
  const name = profile.company_name || profile.contact_name;
  const verified = profile.verification_status === 'verified';
  const premium = profile.premium_tier !== 'free';
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;
  const deals = profile.completed_deals_count ?? 0;
  const responseRate = Math.round(profile.response_rate ?? 0);

  return (
    <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="svc-card">
      <div className={`svc-card-thumb bg-gradient-to-br ${g}`}>
        {premium ? (
          <span className="svc-card-badge svc-card-badge-prime">PREMIUM</span>
        ) : verified ? (
          <span className="svc-card-badge svc-card-badge-promoted">✓ 인증</span>
        ) : null}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="svc-card-thumb-img" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-7xl font-extrabold text-white/70">
            {name.charAt(0)}
          </div>
        )}
      </div>
      <p className="svc-card-title">{name}</p>
      <div className="svc-card-rating">
        <span className="font-bold text-gray-900">거래 {deals.toLocaleString()}건</span>
        {responseRate > 0 && <span className="svc-card-rating-count">응답률 {responseRate}%</span>}
      </div>
      <p className="svc-card-price">
        {profile.business_type ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim()) : '파트너'} · {getRegionLabel(profile.region)}
      </p>
      <div className="svc-card-seller">
        <span className="truncate flex-1">{profile.contact_name || '담당자'}</span>
        {verified && <span className="svc-card-m-badge">인</span>}
      </div>
    </Link>
  );
}
