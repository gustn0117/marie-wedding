'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import type { Event, Job, Post, Profile } from '@/types/database';
import BusinessTypeIcon, { CheckIcon } from '@/shared/components/icons/BusinessTypeIcon';
import FeaturedJobsCarousel from '@/features/home/FeaturedJobsCarousel';

interface HomeContentProps {
  posts: Post[];
  jobs: Job[];
  featuredJobs?: Job[];
  profiles: Profile[];
  events: Event[];
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


const HOT_KEYWORDS = ['예식장', '드레스', '스튜디오', '메이크업', '플래너', '예식 도우미'] as const;

export default function HomeContent({ posts, jobs, featuredJobs: adminFeaturedJobs = [], profiles, events, counts }: HomeContentProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : ROUTES.JOBS);
  };

  const featuredJobs = useMemo(() => jobs.slice(0, 8), [jobs]);
  const featuredProfiles = useMemo(() => profiles.slice(0, 8), [profiles]);
  const featuredEvents = useMemo(() => events.slice(0, 4), [events]);
  const featuredPosts = useMemo(() => posts.slice(0, 6), [posts]);

  return (
    <div className="pb-16">
      {/* Hero — 가운데 정렬 + 옅은 그래디언트 + 미세 dot 패턴 */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
        {/* 미세 dot 패턴 — 무채색 깊이감 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.45) 1px, transparent 0)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0) 75%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0) 75%)',
          }}
        />

        <div className="relative max-w-[1280px] mx-auto px-5 pt-14 pb-12 sm:pt-20 sm:pb-14">
          <div className="flex flex-col items-center text-center">
            {/* Eyebrow */}
            <p className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-[11px] font-bold tracking-wider text-gray-600 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F2C879]" aria-hidden />
              Marié · 웨딩업계 전문 구인구직
            </p>

            {/* 제목 */}
            <h1 className="mt-5 text-[34px] sm:text-[44px] font-bold leading-[1.18] tracking-tight text-ink">
              조건에 맞는 웨딩 일자리와<br className="lg:hidden" />
              {' '}<span className="italic font-semibold">인재</span>를 찾아보세요
            </h1>
            <p className="mt-3 text-[13.5px] sm:text-[14.5px] text-gray-500 leading-relaxed max-w-[520px]">
              예식장·드레스·스튜디오·메이크업·플래너까지 — 한 곳에서 검색하고 바로 지원하세요.
            </p>

            {/* 검색바 */}
            <form
              onSubmit={handleSearch}
              className="mt-8 sm:mt-9 flex h-14 sm:h-16 overflow-hidden rounded-2xl border border-gray-200 bg-white w-full max-w-[640px] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] focus-within:border-ink focus-within:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.25)] transition-all"
            >
              <span className="pl-5 flex items-center text-gray-400" aria-hidden>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="업체명, 직무, 지역을 검색하세요"
                className="flex-1 min-w-0 px-3 text-[15.5px] outline-none placeholder:text-gray-400 text-ink"
                aria-label="검색어"
              />
              <button
                type="submit"
                className="m-2 px-5 sm:px-7 rounded-xl bg-ink text-white text-sm font-bold hover:bg-ink/90 transition-colors"
              >
                검색
              </button>
            </form>

            {/* 인기 검색어 */}
            <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">인기</span>
              {HOT_KEYWORDS.map((kw) => (
                <Link
                  key={kw}
                  href={`/search?q=${encodeURIComponent(kw)}`}
                  className="text-[12.5px] text-gray-600 hover:text-ink hover:underline underline-offset-4 transition-colors"
                >
                  #{kw}
                </Link>
              ))}
            </div>

            {/* 통계 뱃지 — 신뢰 지표 */}
            <div className="mt-7 flex items-center gap-5 sm:gap-7 text-center">
              <Stat value={counts.jobs} label="등록 공고" />
              <Divider />
              <Stat value={counts.verified} label="인증 업체" />
              <Divider />
              <Stat value={counts.profiles} label="활동 회원" />
            </div>
          </div>

          {/* 카테고리 아이콘 그리드 */}
          <div className="mt-14 sm:mt-16 grid grid-cols-5 md:grid-cols-10 gap-2 sm:gap-3">
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


      {/* 금주의 인기공고 — 관리자가 선정한 캐러셀 */}
      {adminFeaturedJobs.length > 0 && (
        <FeaturedJobsCarousel jobs={adminFeaturedJobs} />
      )}

      {/* 추천 인재·업체 프로필 — 전체 폭 */}
      {featuredProfiles.length > 0 && (
        <section className="bg-white pt-10">
          <div className="max-w-[1280px] mx-auto px-5">
            <SectionHeader title="추천 인재·업체 프로필" subtitle="채용과 지원 전 확인할 수 있는 신뢰 프로필" href={ROUTES.DIRECTORY} />
            <BoardList header={['업체', '지역', '거래']}>
              {featuredProfiles.map((p) => <CompanyBoardRow key={p.id} profile={p} />)}
            </BoardList>
          </div>
        </section>
      )}

      {/* 3컬럼 위젯 — 공고 / 행사 / 인기글 */}
      <section className="bg-white py-10">
        <div className="max-w-[1280px] mx-auto px-5 grid gap-5 lg:grid-cols-3">
          {/* 최근 등록된 공고 */}
          <BoxWidget title="최근 등록된 공고" href={ROUTES.JOBS}>
            {featuredJobs.length === 0 ? (
              <BoxEmpty message="아직 등록된 공고가 없습니다." />
            ) : (
              <BoardList header={['공고', '회사']}>
                {featuredJobs.slice(0, 6).map((job) => <JobBoardRow key={job.id} job={job} compact />)}
              </BoardList>
            )}
          </BoxWidget>

          {/* 다가오는 행사·박람회 */}
          <BoxWidget title="다가오는 행사·박람회" href={ROUTES.EVENTS}>
            {featuredEvents.length === 0 ? (
              <BoxEmpty message="예정된 행사가 없습니다." />
            ) : (
              <BoardList header={['행사', '일정']}>
                {featuredEvents.slice(0, 6).map((event) => <EventBoardRow key={event.id} event={event} compact />)}
              </BoardList>
            )}
          </BoxWidget>

          {/* 커뮤니티 인기글 */}
          <BoxWidget title="커뮤니티 인기글" href={ROUTES.COMMUNITY}>
            {featuredPosts.length === 0 ? (
              <BoxEmpty message="첫 글의 주인공이 되어보세요." />
            ) : (
              <BoardList header={['글', '작성']}>
                {featuredPosts.slice(0, 6).map((post, idx) => (
                  <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="board-row group">
                    <span className={`w-5 text-center font-bold tabular-nums shrink-0 ${idx < 3 ? 'text-primary' : 'text-gray-400'}`}>{idx + 1}</span>
                    <span className="board-row-title group-hover:text-primary transition-colors">{post.title}</span>
                    <span className="board-row-meta">
                      <span className="tabular-nums">{formatRelativeTime(post.created_at)}</span>
                    </span>
                  </Link>
                ))}
              </BoardList>
            )}
          </BoxWidget>
        </div>
      </section>
    </div>
  );
}

/* === 박스 위젯 (3컬럼 셀) === */
function BoxWidget({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between pb-2 border-b border-gray-200">
        <h3 className="text-[18px] font-bold tracking-tight text-ink">{title}</h3>
        <Link href={href} className="text-[12px] font-bold text-gray-500 hover:text-ink inline-flex items-center gap-0.5">
          더보기
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </Link>
      </div>
      {children}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[18px] sm:text-[20px] font-bold text-ink tabular-nums leading-none">
        {value.toLocaleString()}
        <span className="text-[12px] font-bold text-gray-400 align-top ml-0.5">+</span>
      </p>
      <p className="mt-1 text-[10.5px] sm:text-[11px] font-semibold text-gray-500 tracking-wide">{label}</p>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-7 bg-gray-200" aria-hidden />;
}

function BoxEmpty({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-[13px] text-gray-400">{message}</p>
    </div>
  );
}

/* === 게시판 리스트 컨테이너 — 미니멀 (선/박스 없음) === */
function BoardList({ children, header }: { children: ReactNode; header?: string[] }) {
  return (
    <div>
      {header && (
        <div className="board-head">
          <span className="flex-1">{header[0] ?? '제목'}</span>
          {header[1] && <span className="hidden sm:inline w-24 text-right">{header[1]}</span>}
          {header[2] && <span className="w-16 text-right">{header[2]}</span>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

/* === 공고 게시판 행 — 한 줄 === */
function JobBoardRow({ job, compact = false }: { job: Job; compact?: boolean }) {
  const company = job.author?.company_name || job.author?.contact_name || '담당자';
  const businessType = getBusinessTypeLabel(job.business_type);
  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="board-row group">
      <span className="board-cat">{businessType}</span>
      <span className="board-row-title group-hover:text-primary transition-colors">{job.title}</span>
      <span className="board-row-meta">
        {compact ? (
          <span className="truncate max-w-[100px]">{company}</span>
        ) : (
          <>
            <span className="hidden sm:inline truncate max-w-[120px]">{company}</span>
            <span className="tabular-nums">{formatRelativeTime(job.created_at)}</span>
          </>
        )}
      </span>
    </Link>
  );
}

/* === 업체 프로필 게시판 행 — 한 줄 === */
function CompanyBoardRow({ profile }: { profile: Profile }) {
  const name = profile.company_name || profile.contact_name;
  const verified = profile.verification_status === 'verified';
  const bizLabel = profile.business_type ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim()) : '파트너';
  const region = getRegionLabel(profile.region);
  const deals = profile.completed_deals_count ?? 0;
  return (
    <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="board-row group">
      <span className="board-cat">{bizLabel}</span>
      <span className="board-row-title group-hover:text-primary transition-colors inline-flex items-center gap-1.5">
        {name}
        {verified && (
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary-50 text-primary shrink-0">
            <CheckIcon className="w-2.5 h-2.5" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="board-row-meta">
        <span>{region}</span>
        {deals > 0 && <span className="tabular-nums">거래 {deals}</span>}
      </span>
    </Link>
  );
}

/* === 행사·박람회 게시판 행 — 한 줄 === */
function EventBoardRow({ event, compact = false }: { event: Event; compact?: boolean }) {
  const dateLabel = event.start_date
    ? event.start_date.slice(5, 10).replace('-', '/')
    : '상시';
  const fullDateLabel = event.start_date
    ? `${event.start_date.slice(5, 10).replace('-', '/')}${event.end_date ? ` - ${event.end_date.slice(5, 10).replace('-', '/')}` : ''}`
    : '상시';
  const typeLabel = event.type === 'event' ? '박람회' : event.type === 'news' ? '소식' : event.type === 'notice' ? '공지' : '';
  return (
    <Link href={ROUTES.EVENTS_DETAIL(event.id)} className="board-row group">
      <span className="board-cat">{typeLabel}</span>
      <span className="board-row-title group-hover:text-primary transition-colors">{event.title}</span>
      <span className="board-row-meta">
        {compact ? (
          <span className="tabular-nums">{dateLabel}</span>
        ) : (
          <>
            {event.location && <span className="hidden sm:inline truncate max-w-[120px]">{event.location}</span>}
            <span className="tabular-nums">{fullDateLabel}</span>
          </>
        )}
      </span>
    </Link>
  );
}

/**
 * 가로 스크롤 캐러셀 — 키보드/마우스/터치 모두 지원.
 * 이전: 단순 div.h-scroll — 키보드 사용자에겐 스크롤 방법 가이드 없음, 인디케이터 없음.
 * 수정: aria-label 가진 region role + 좌우 스크롤 버튼.
 *   터치는 native 스와이프, 키보드는 Tab으로 카드 포커스 후 화살표 키 작동.
 */
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


