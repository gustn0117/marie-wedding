'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES, BUSINESS_TYPES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getCategoryLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import Badge from '@/shared/components/Badge';
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

const SEARCH_TAGS = ['웨딩플래너', '예식장 매니저', '드레스 피팅', '주말 알바', '스튜디오 보정'];

const QUICK_ACTIONS = [
  { href: ROUTES.JOBS, title: '채용 탐색', description: '지역·업종별 공고를 한눈에', emoji: '🔍' },
  { href: `${ROUTES.JOBS}?type=matching`, title: '파트너 섭외', description: '협업 가능한 업체 찾기', emoji: '🤝' },
  { href: ROUTES.DIRECTORY, title: '업체 디렉토리', description: '검증된 프로필 모음', emoji: '🏢' },
  { href: ROUTES.COMMUNITY, title: '커뮤니티', description: '현장 노하우 공유', emoji: '💬' },
] as const;

export default function HomeContent({ posts, jobs, profiles, counts, mySidebar }: HomeContentProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    router.push(q ? `${ROUTES.JOBS}?search=${encodeURIComponent(q)}` : ROUTES.JOBS);
  };

  const featuredJobs = useMemo(() => jobs.slice(0, 6), [jobs]);
  const featuredProfiles = useMemo(() => profiles.slice(0, 4), [profiles]);
  const featuredPosts = useMemo(() => posts.slice(0, 4), [posts]);

  return (
    <div className="pb-16">
      {/* HERO — search-centered */}
      <section className="bg-gradient-to-b from-secondary-50 to-white pt-16 pb-12 sm:pt-20 sm:pb-16">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="platform-hero-copy">
            <span className="platform-eyebrow">웨딩 산업 B2B 네트워크</span>
            <h1 className="platform-hero-title">
              웨딩 업계 채용과<br />파트너 연결의 가장 빠른 길
            </h1>
            <p className="platform-hero-text">
              공고 탐색부터 지원 관리, 업체 디렉토리, 현장 커뮤니티까지
              <br className="hidden sm:block" />
              한 화면에서 매끄럽게 이어갑니다.
            </p>

            <form onSubmit={handleSearch} className="platform-search-box mt-2">
              <div className="flex items-center pl-5 sm:pl-6 text-gray-400">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="직무, 업체명, 지역으로 검색"
                className="min-w-0 flex-1 px-4 text-[15px] sm:text-[16px] font-medium outline-none placeholder:text-gray-400"
              />
              <button type="submit" className="bg-primary px-6 sm:px-8 text-sm sm:text-base font-semibold text-white transition-colors hover:bg-primary-dark">
                검색
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm">
              <span className="text-gray-500 mr-1">인기</span>
              {SEARCH_TAGS.map((tag) => (
                <Link
                  key={tag}
                  href={`${ROUTES.JOBS}?search=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-white border border-gray-200 px-3 py-1.5 text-gray-700 text-[13px] hover:border-gray-400 hover:text-gray-900 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          {/* Live metrics — full-width pills */}
          <div className="mt-12 grid grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto text-center">
            <MetricPill label="인증 업체" value={counts.verified} suffix="곳" />
            <MetricPill label="최근 30일 신규 공고" value={counts.recentJobs} suffix="건" />
            <MetricPill label="활성 파트너" value={counts.profiles} suffix="곳" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 space-y-12 sm:space-y-16 pt-4">

        {/* My workspace row (로그인 시만) */}
        {mySidebar && (
          <section className="-mt-8 sm:-mt-10">
            {mySidebar}
          </section>
        )}

        {/* Quick actions — 4 big cards */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.title} href={a.href} className="action-tile group">
                <span className="text-3xl">{a.emoji}</span>
                <div>
                  <p className="text-[16px] font-bold text-gray-900 group-hover:text-primary transition-colors">{a.title}</p>
                  <p className="mt-1 text-[13px] text-gray-500 leading-relaxed">{a.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured jobs */}
        <section>
          <SectionHeader title="최신 채용·섭외 공고" subtitle="최근 등록된 공고를 만나보세요" href={ROUTES.JOBS} />
          {featuredJobs.length === 0 ? (
            <EmptyHint message="아직 등록된 공고가 없습니다. 첫 번째 공고를 등록해 보세요." href={ROUTES.JOBS_NEW} cta="공고 등록" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredJobs.map((job) => <FeaturedJobCard key={job.id} job={job} />)}
            </div>
          )}
        </section>

        {/* Featured directory */}
        <section>
          <SectionHeader title="추천 파트너 업체" subtitle="검증된 업체 프로필을 확인하세요" href={ROUTES.DIRECTORY} />
          {featuredProfiles.length === 0 ? (
            <EmptyHint message="아직 등록된 업체가 없습니다." href={ROUTES.DIRECTORY_REGISTER} cta="업체 등록" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredProfiles.map((p) => <DirectoryCardLite key={p.id} profile={p} />)}
            </div>
          )}
        </section>

        {/* Browse by category */}
        <section>
          <SectionHeader title="직무로 빠르게 찾기" subtitle="" href={ROUTES.JOBS} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {BUSINESS_TYPES.map((bt) => (
              <Link
                key={bt.value}
                href={`${ROUTES.JOBS}?businessType=${bt.value}`}
                className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-center transition-all hover:border-primary hover:shadow-card hover:-translate-y-0.5"
              >
                <p className="text-[15px] font-semibold text-gray-900">{bt.label}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Community */}
        {featuredPosts.length > 0 && (
          <section>
            <SectionHeader title="커뮤니티 업데이트" subtitle="현장에서 나누는 노하우" href={ROUTES.COMMUNITY} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {featuredPosts.map((post) => (
                <Link
                  key={post.id}
                  href={ROUTES.COMMUNITY_DETAIL(post.id)}
                  className="group rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-card hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge kind="category">{getCategoryLabel(post.category)}</Badge>
                    <time className="text-xs text-gray-400">{formatRelativeTime(post.created_at)}</time>
                  </div>
                  <p className="text-[15px] font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1 mb-1">{post.title}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>조회 {post.view_count.toLocaleString()}</span>
                    <span>·</span>
                    <span>댓글 {post.comment_count ?? 0}</span>
                    <span>·</span>
                    <span>좋아요 {post.like_count.toLocaleString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MetricPill({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p className="text-[12px] sm:text-[13px] text-gray-500 mb-1">{label}</p>
      <p className="text-[24px] sm:text-[28px] font-bold text-gray-900 tabular-nums tracking-tight">
        {value.toLocaleString()}
        {suffix && <span className="text-[14px] sm:text-[16px] font-semibold text-gray-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  return (
    <div className="flex items-end justify-between mb-5 sm:mb-6">
      <div>
        <h2 className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-[14px] text-gray-500">{subtitle}</p>}
      </div>
      <Link href={href} className="text-[13px] font-semibold text-gray-500 hover:text-primary transition-colors shrink-0">
        전체보기 →
      </Link>
    </div>
  );
}

function EmptyHint({ message, href, cta }: { message: string; href: string; cta: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      <Link href={href} className="btn-primary inline-flex">{cta}</Link>
    </div>
  );
}

function FeaturedJobCard({ job }: { job: Job }) {
  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;
  const company = job.author?.company_name || job.author?.contact_name || '업체명 미등록';
  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-card hover:-translate-y-0.5 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-500 truncate">{company}</p>
        </div>
        {isExpired && <span className="rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold px-2 py-0.5 shrink-0">마감</span>}
        {!isExpired && job.is_promoted && <span className="rounded-full bg-primary-50 text-primary text-[11px] font-semibold px-2 py-0.5 shrink-0">추천</span>}
      </div>
      <h3 className="text-[16px] sm:text-[17px] font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-primary transition-colors min-h-[44px]">
        {job.title}
      </h3>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-600">
        <span className="font-medium">{getRegionLabel(job.region)}</span>
        <span className="text-gray-300">·</span>
        <span>{getEmploymentTypeLabel(job.employment_type)}</span>
        <span className="text-gray-300">·</span>
        <span>{getBusinessTypeLabel(job.business_type)}</span>
      </div>
      {job.salary_info && (
        <p className="text-[13px] text-gray-700">
          <span className="text-gray-400 mr-1">급여</span>
          <span className="font-semibold">{job.salary_info}</span>
        </p>
      )}
      <div className="pt-2 mt-auto border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
        <span>{formatRelativeTime(job.created_at)}</span>
        {job.view_count > 0 && <span>조회 {job.view_count.toLocaleString()}</span>}
      </div>
    </Link>
  );
}

function DirectoryCardLite({ profile }: { profile: Profile }) {
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;
  const name = profile.company_name || profile.contact_name;
  return (
    <Link
      href={ROUTES.DIRECTORY_DETAIL(profile.id)}
      className="group rounded-xl border border-gray-200 bg-white overflow-hidden transition-all hover:shadow-card hover:-translate-y-0.5"
    >
      <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="w-full h-full object-contain p-4" />
        ) : (
          <span className="text-3xl font-bold text-gray-300">{name.charAt(0)}</span>
        )}
      </div>
      <div className="p-4">
        <p className="text-[15px] font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1">{name}</p>
        <p className="text-[12px] text-gray-500 mt-1 line-clamp-1">
          {profile.business_type ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim()) : '파트너'} · {getRegionLabel(profile.region)}
        </p>
      </div>
    </Link>
  );
}
