'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import type { Job, Post, Profile } from '@/types/database';
import FeaturedJobsCarousel from '@/features/home/FeaturedJobsCarousel';
import FeaturedProfilesCarousel from '@/features/home/FeaturedProfilesCarousel';

interface HomeContentProps {
  posts: Post[];
  jobs: Job[];
  featuredJobs?: Job[];
  featuredProfiles?: Profile[];
  profiles: Profile[];
}

/** 메인 하단 — 관리자 선정 캐러셀 2종 + 최근 공고/프로필/인기글 3컬럼 위젯 */
export default function HomeContent({ posts, jobs, featuredJobs: adminFeaturedJobs = [], featuredProfiles: adminFeaturedProfiles = [], profiles }: HomeContentProps) {
  const featuredJobs = useMemo(() => jobs.slice(0, 8), [jobs]);
  const featuredPosts = useMemo(() => posts.slice(0, 6), [posts]);

  return (
    <div className="pb-16">
      {/* 금주의 인기공고 — 관리자가 선정한 캐러셀 */}
      {adminFeaturedJobs.length > 0 && (
        <FeaturedJobsCarousel jobs={adminFeaturedJobs} />
      )}

      {/* 추천 인재·업체 프로필 — 관리자 지정 카드 캐러셀 */}
      {adminFeaturedProfiles.length > 0 && (
        <FeaturedProfilesCarousel profiles={adminFeaturedProfiles} />
      )}

      {/* 3컬럼 위젯 — 최근공고 / 최근 프로필 / 인기글 */}
      <section className="bg-white py-8 sm:py-10">
        <div className="shell-wide grid gap-5 lg:grid-cols-3">
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

          {/* 최근 등록된 인재·업체 프로필 */}
          <BoxWidget title="최근 등록된 프로필" href={ROUTES.DIRECTORY}>
            {profiles.length === 0 ? (
              <BoxEmpty message="아직 등록된 프로필이 없습니다." />
            ) : (
              <BoardList header={['업체·인재', '지역']}>
                {profiles.slice(0, 6).map((p) => <CompanyBoardRow key={p.id} profile={p} />)}
              </BoardList>
            )}
          </BoxWidget>

          {/* 커뮤니티 인기글 */}
          <BoxWidget title="커뮤니티 인기글" href={ROUTES.COMMUNITY}>
            {featuredPosts.length === 0 ? (
              <BoxEmpty message="첫 글의 주인공이 되어보세요." />
            ) : (
              <BoardList header={['글', '작성']}>
                {featuredPosts.slice(0, 6).map((post) => (
                  <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="board-row group">
                    <span className="board-row-title group-hover:text-primary transition-colors">
                      {post.is_notice && (
                        <span className="inline-flex items-center rounded bg-primary px-1.5 py-0.5 mr-1.5 text-[10px] font-bold text-white align-middle">공지</span>
                      )}
                      {post.title}
                    </span>
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
  const bizLabel = profile.business_type ? getBusinessTypeLabel(profile.business_type.split(',')[0].trim()) : '파트너';
  const region = getRegionLabel(profile.region);
  return (
    <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="board-row group">
      <span className="board-cat">{bizLabel}</span>
      <span className="board-row-title group-hover:text-primary transition-colors">
        {name}
      </span>
      <span className="board-row-meta">
        <span>{region}</span>
      </span>
    </Link>
  );
}
