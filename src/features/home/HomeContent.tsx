'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
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
  };
}

type IconName = 'briefcase' | 'building' | 'users' | 'message' | 'spark' | 'chart';

const fallbackJobs = [
  { company: '그랜드 웨딩홀', title: '예식장 매니저 정규직 채용', type: '예식장', region: '서울 강남', pay: '연 3,400만원' },
  { company: '로즈드레스 청담', title: '드레스 피팅 전문가 경력직 모집', type: '드레스샵', region: '서울 청담', pay: '면접 후 결정' },
  { company: '루미에르 스튜디오', title: '웨딩 포토그래퍼 및 보정 담당자', type: '스튜디오', region: '서울 마포', pay: '월 280만원' },
  { company: '블룸 메이크업', title: '브라이덜 메이크업 아티스트', type: '메이크업', region: '경기 성남', pay: '협의' },
] as const;

const fallbackCompanies = [
  { name: '그랜드 웨딩홀', desc: '대형 연회장 운영 및 신입 교육 체계 보유', type: '예식장', region: '서울' },
  { name: '로즈드레스 청담', desc: '수입 드레스 편집숍, 주말 피팅팀 상시 모집', type: '드레스샵', region: '서울' },
  { name: '루미에르 스튜디오', desc: '촬영, 보정, 앨범 제작을 함께 운영하는 스튜디오', type: '스튜디오', region: '서울' },
  { name: '블룸 메이크업', desc: '브라이덜 헤어·메이크업 전문 파트너', type: '메이크업', region: '경기' },
] as const;

const searchTags = ['웨딩플래너', '예식장 매니저', '드레스 피팅', '주말 알바', '스튜디오 보정'];

export default function HomeContent({ posts, jobs, profiles, counts }: HomeContentProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');

  const jobItems = useMemo(() => {
    if (jobs.length > 0) {
      return jobs.map((job) => ({
        href: ROUTES.JOBS_DETAIL(job.id),
        company: job.author?.company_name || job.author?.contact_name || '업체명 미등록',
        title: job.title,
        type: getBusinessTypeLabel(job.business_type),
        region: getRegionLabel(job.region || job.author?.region || ''),
        pay: job.salary_info || getEmploymentTypeLabel(job.employment_type),
        meta: formatRelativeTime(job.created_at),
      }));
    }

    return fallbackJobs.map((job) => ({
      href: ROUTES.JOBS,
      ...job,
      meta: '추천 공고',
    }));
  }, [jobs]);

  const companyItems = useMemo(() => {
    if (profiles.length > 0) {
      return profiles.slice(0, 4).map((profile) => {
        const bio = profile.bio ? profile.bio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
        const imageUrl = profile.profile_image
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
          : null;

        return {
          href: ROUTES.DIRECTORY_DETAIL(profile.id),
          name: profile.company_name || profile.contact_name,
          desc: bio || '웨딩업계 파트너 프로필',
          type: profile.business_type ? getBusinessTypeLabel(profile.business_type) : '파트너',
          region: getRegionLabel(profile.region),
          imageUrl,
        };
      });
    }

    return fallbackCompanies.map((company) => ({
      href: ROUTES.DIRECTORY,
      ...company,
      imageUrl: null as string | null,
    }));
  }, [profiles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    router.push(q ? `${ROUTES.JOBS}?search=${encodeURIComponent(q)}` : ROUTES.JOBS);
  };

  const metricJobs = counts.jobs || jobs.length;
  const metricProfiles = counts.profiles || profiles.length;
  const metricPosts = counts.posts || posts.length;

  return (
    <div className="pb-8">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-6 xl:px-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="platform-eyebrow">Marié Platform</span>
                <span className="rounded border border-accent-200 bg-accent-50 px-2 py-0.5 text-[12px] font-bold text-accent-600">
                  B2B 웨딩 네트워크
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <h1 className="text-[28px] font-bold leading-tight text-gray-950 sm:text-[34px]">
                    채용, 파트너 섭외, 업계 소식을 한 화면에서 운영하세요
                  </h1>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">
                    웨딩홀, 드레스, 스튜디오, 플래너까지 실무 연결에 필요한 탐색과 게시를 빠르게 이어갑니다.
                  </p>
                </div>

                <div className="platform-panel-soft p-3">
                  <p className="text-[12px] font-bold text-gray-500">오늘의 플랫폼 현황</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MiniMetric label="공고" value={metricJobs} />
                    <MiniMetric label="업체" value={metricProfiles} />
                    <MiniMetric label="글" value={metricPosts} />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSearch} className="mt-5 flex min-h-[58px] overflow-hidden rounded border-2 border-primary bg-white shadow-sm">
                <div className="flex items-center pl-5 text-primary">
                  <Icon name="spark" className="h-5 w-5" />
                </div>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="직무, 업체명, 지역을 검색하세요"
                  className="min-w-0 flex-1 px-4 text-[16px] font-semibold outline-none placeholder:text-gray-400"
                />
                <button type="submit" className="bg-primary px-6 text-sm font-bold text-white transition-colors hover:bg-primary-dark sm:px-8">
                  검색
                </button>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-gray-800">인기 검색</span>
                {searchTags.map((tag) => (
                  <Link
                    key={tag}
                    href={`${ROUTES.JOBS}?search=${encodeURIComponent(tag)}`}
                    className="rounded border border-gray-200 px-3 py-1 text-gray-600 transition-colors hover:border-primary hover:text-primary"
                  >
                    {tag}
                  </Link>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <QuickAction href={ROUTES.JOBS} title="채용 탐색" description="지역·업종별 공고" icon="briefcase" />
                <QuickAction href={`${ROUTES.JOBS}?type=matching`} title="파트너 섭외" description="협업 공고 확인" icon="users" />
                <QuickAction href={ROUTES.DIRECTORY} title="업체 디렉토리" description="검증된 프로필" icon="building" />
                <QuickAction href={ROUTES.COMMUNITY} title="커뮤니티" description="현장 노하우 공유" icon="message" />
              </div>
            </div>

            <aside className="platform-panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="platform-eyebrow">Workspace</p>
                  <h2 className="mt-1 text-lg font-bold text-gray-950">운영 바로가기</h2>
                </div>
                <span className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600">무료 등록</span>
              </div>

              <div className="mt-4 grid gap-2">
                <Link href={ROUTES.JOBS_NEW} className="btn-primary w-full">
                  <Icon name="briefcase" className="h-4 w-4" />
                  채용공고 등록
                </Link>
                <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-secondary w-full">
                  <Icon name="building" className="h-4 w-4" />
                  업체 프로필 등록
                </Link>
              </div>

              <div className="mt-4 divide-y divide-gray-100 rounded border border-gray-200">
                <BoardLink href={`${ROUTES.JOBS}?type=hiring`} title="채용 중인 포지션" value={metricJobs} />
                <BoardLink href={ROUTES.DIRECTORY} title="등록 파트너" value={metricProfiles} />
                <BoardLink href={ROUTES.COMMUNITY} title="커뮤니티 업데이트" value={metricPosts} />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] space-y-5 px-3 py-5 sm:px-5 lg:px-6 xl:px-8">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="platform-panel">
            <SectionHeader title="직무별 채용" href={ROUTES.JOBS} />
            <div className="grid grid-cols-2 sm:grid-cols-5">
              {BUSINESS_TYPES.map((type) => (
                <Link
                  key={type.value}
                  href={`${ROUTES.JOBS}?businessType=${type.value}`}
                  className="group flex min-h-[84px] flex-col justify-center border-b border-r border-gray-100 px-4 py-3 transition-colors hover:bg-primary-50/45"
                >
                  <span className="mb-2 flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-sm font-bold text-gray-700 transition-colors group-hover:border-primary group-hover:text-primary">
                    {type.label.charAt(0)}
                  </span>
                  <span className="text-sm font-bold text-gray-800 group-hover:text-primary">{type.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="platform-panel">
            <SectionHeader title="지역별 채용" href={ROUTES.JOBS} />
            <div className="grid grid-cols-3 gap-1.5 p-4">
              {REGIONS.slice(0, 15).map((region) => (
                <Link
                  key={region.value}
                  href={`${ROUTES.JOBS}?region=${region.value}`}
                  className="rounded border border-gray-200 px-2 py-2 text-center text-sm font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary"
                >
                  {region.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="platform-panel">
            <SectionHeader title="최신 채용·섭외 공고" href={ROUTES.JOBS} label="실시간" />
            <div className="divide-y divide-gray-100">
              {jobItems.slice(0, 6).map((job) => (
                <Link
                  key={`${job.company}-${job.title}`}
                  href={job.href}
                  className="group grid gap-3 px-4 py-4 transition-colors hover:bg-primary-50/40 md:grid-cols-[190px_1fr_140px] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gray-200 bg-secondary-50 text-sm font-bold text-primary">
                      {job.company.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{job.company}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{job.region}</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[16px] font-bold text-gray-950 transition-colors group-hover:text-primary">{job.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge kind="category">{job.type}</Badge>
                      <Badge kind="attr">{job.pay}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    <span className="text-xs font-semibold text-gray-500">{job.meta}</span>
                    <span className="rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors group-hover:border-primary group-hover:text-primary">
                      상세
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="platform-panel">
            <SectionHeader title="파트너 네트워크" href={ROUTES.DIRECTORY} />
            <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-1">
              {companyItems.map((company) => (
                <Link
                  key={company.name}
                  href={company.href}
                  className="group flex gap-3 border-b border-gray-100 p-4 transition-colors hover:bg-primary-50/40 sm:border-r xl:border-r-0"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white text-lg font-bold text-gray-700 transition-colors group-hover:border-primary group-hover:text-primary">
                    {company.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={company.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      company.name.charAt(0)
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-950 transition-colors group-hover:text-primary">{company.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-gray-500">{company.type} · {company.region}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-gray-500">{company.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="platform-panel">
            <SectionHeader title="커뮤니티 업데이트" href={ROUTES.COMMUNITY} />
            <div className="divide-y divide-gray-100">
              {posts.length > 0 ? posts.map((post) => (
                <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="group block px-4 py-3 transition-colors hover:bg-primary-50/40">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge kind="category">{getCategoryLabel(post.category)}</Badge>
                    <time className="text-xs text-gray-400">{formatRelativeTime(post.created_at)}</time>
                  </div>
                  <p className="line-clamp-1 text-sm font-bold text-gray-950 transition-colors group-hover:text-primary">{post.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span>조회 {post.view_count.toLocaleString()}</span>
                    <span>댓글 {post.comment_count ?? 0}</span>
                    <span>좋아요 {post.like_count.toLocaleString()}</span>
                  </div>
                </Link>
              )) : (
                <div className="px-4 py-10 text-center text-sm text-gray-400">아직 커뮤니티 글이 없습니다.</div>
              )}
            </div>
          </div>

          <div className="platform-panel p-4">
            <div className="flex items-center gap-3">
              <span className="icon-box">
                <Icon name="chart" className="h-4 w-4" />
              </span>
              <div>
                <p className="platform-eyebrow">Operations</p>
                <h2 className="platform-section-title mt-0.5">빠른 운영 메뉴</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <ServiceLink href={ROUTES.MYPAGE} title="마이페이지" description="내 공고, 지원, 북마크 관리" />
              <ServiceLink href={ROUTES.MYPAGE_NOTIFICATIONS} title="알림센터" description="지원 및 커뮤니티 알림 확인" />
              <ServiceLink href="/contact" title="고객센터" description="문의와 제휴 요청 접수" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 bg-white px-2 py-2 text-center">
      <span className="block text-[18px] font-bold text-gray-950">{value.toLocaleString()}</span>
      <span className="mt-0.5 block text-[11px] font-semibold text-gray-500">{label}</span>
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: IconName;
}) {
  return (
    <Link href={href} className="action-tile group">
      <span className="icon-box transition-colors group-hover:border-primary-300 group-hover:bg-white">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-gray-950 group-hover:text-primary">{title}</span>
        <span className="mt-1 block text-xs font-semibold text-gray-500">{description}</span>
      </span>
    </Link>
  );
}

function BoardLink({ href, title, value }: { href: string; title: string; value: number }) {
  return (
    <Link href={href} className="flex items-center justify-between px-3 py-3 text-sm transition-colors hover:bg-primary-50/50">
      <span className="font-semibold text-gray-700">{title}</span>
      <span className="font-bold text-primary">{value.toLocaleString()}</span>
    </Link>
  );
}

function SectionHeader({ title, href, label }: { title: string; href: string; label?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <h2 className="platform-section-title">{title}</h2>
        {label && <span className="rounded border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-600">{label}</span>}
      </div>
      <Link href={href} className="text-xs font-bold text-gray-500 transition-colors hover:text-primary">전체보기</Link>
    </div>
  );
}

function ServiceLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded border border-gray-200 px-3 py-3 transition-colors hover:border-primary-300 hover:bg-primary-50/40">
      <span className="block text-sm font-bold text-gray-950">{title}</span>
      <span className="mt-1 block text-xs font-semibold text-gray-500">{description}</span>
    </Link>
  );
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = { className, fill: 'none', viewBox: '0 0 24 24', strokeWidth: 1.8, stroke: 'currentColor' };

  if (name === 'building') {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 21V5.25A2.25 2.25 0 016.75 3h6a2.25 2.25 0 012.25 2.25V21m4.5 0V8.25A2.25 2.25 0 0017.25 6H15M8.25 7.5h3m-3 3h3m-3 3h3M8.25 21v-3.375c0-.621.504-1.125 1.125-1.125h1.5c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    );
  }

  if (name === 'users') {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    );
  }

  if (name === 'message') {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.142-4.03 7.5-9 7.5a10.69 10.69 0 01-3.17-.47L3 21l1.97-4.09A6.874 6.874 0 013 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5z" />
      </svg>
    );
  }

  if (name === 'spark') {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    );
  }

  if (name === 'chart') {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125h3.75V21H3v-7.875zM9.375 9h3.75v12h-3.75V9zM15.75 3h3.75v18h-3.75V3z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25A2.25 2.25 0 0118 20.65H6a2.25 2.25 0 01-2.25-2.25v-4.25m16.5 0A2.18 2.18 0 0021 12.489V8.706c0-1.081-.768-2.015-1.837-2.175A48.111 48.111 0 0015.75 6.15V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.9c-1.153.08-2.292.207-3.413.381C3.768 6.691 3 7.625 3 8.706v3.783c0 .636.28 1.241.75 1.661m16.5 0A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.5-1.22a2.016 2.016 0 01-.75-.38m12-8.006a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
