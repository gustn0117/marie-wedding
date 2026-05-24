'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { formatRelativeTime, getCategoryLabel } from '@/shared/utils/format';
import Badge from '@/shared/components/Badge';
import type { Post } from '@/types/database';

interface HomeContentProps {
  posts: Post[];
}

const featuredJobs = [
  { company: '그랜드 웨딩홀', title: '예식장 매니저 정규직 채용', type: '예식장', region: '서울 강남', pay: '연 3,400만원' },
  { company: '로즈드레스 청담', title: '드레스 피팅 전문가 경력직 모집', type: '드레스샵', region: '서울 청담', pay: '면접 후 결정' },
  { company: '루미에르 스튜디오', title: '웨딩 포토그래퍼 및 보정 담당자', type: '스튜디오', region: '서울 마포', pay: '월 280만원' },
  { company: '블룸 메이크업', title: '브라이덜 메이크업 아티스트', type: '메이크업', region: '경기 성남', pay: '협의' },
  { company: '엘레강스 플래너', title: '웨딩플래너 신입/경력 공개채용', type: '웨딩플래너', region: '서울', pay: '성과급' },
] as const;

const partnerCompanies = [
  { name: '그랜드 웨딩홀', desc: '대형 연회장 운영 및 신입 교육 체계 보유', type: '예식장', region: '서울' },
  { name: '로즈드레스 청담', desc: '수입 드레스 편집숍, 주말 피팅팀 상시 모집', type: '드레스샵', region: '서울' },
  { name: '루미에르 스튜디오', desc: '촬영, 보정, 앨범 제작을 함께 운영하는 스튜디오', type: '스튜디오', region: '서울' },
  { name: '블룸 메이크업', desc: '브라이덜 헤어·메이크업 전문 파트너', type: '메이크업', region: '경기' },
] as const;

const searchTags = ['웨딩플래너', '예식장 매니저', '드레스 피팅', '주말 알바', '스튜디오 보정'];

export default function HomeContent({ posts }: HomeContentProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    router.push(q ? `${ROUTES.JOBS}?search=${encodeURIComponent(q)}` : ROUTES.JOBS);
  };

  return (
    <div className="bg-background pb-8">
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 py-7">
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-600">
                <span className="rounded bg-primary-50 px-2 py-1 text-primary">웨딩업계 채용 플랫폼</span>
                <span>채용, 업체 섭외, 커뮤니티를 한 번에</span>
              </div>

              <form onSubmit={handleSearch} className="flex min-h-[58px] overflow-hidden rounded border-2 border-primary bg-white shadow-sm">
                <div className="flex items-center pl-5 text-primary">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="직무, 업체명, 지역을 검색해보세요"
                  className="min-w-0 flex-1 px-4 text-lg font-semibold outline-none placeholder:text-gray-400"
                />
                <button type="submit" className="bg-primary px-7 text-base font-bold text-white hover:bg-primary-dark transition-colors">
                  검색
                </button>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-gray-800">인기검색어</span>
                {searchTags.map((tag) => (
                  <Link key={tag} href={`${ROUTES.JOBS}?search=${encodeURIComponent(tag)}`} className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 hover:border-primary hover:text-primary transition-colors">
                    {tag}
                  </Link>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <SummaryCard label="오늘 올라온 공고" value="128" href={ROUTES.JOBS} color="text-primary" />
                <SummaryCard label="등록 업체" value="2,430" href={ROUTES.DIRECTORY} color="text-accent" />
                <SummaryCard label="커뮤니티 글" value="8,920" href={ROUTES.COMMUNITY} color="text-state-promoted" />
              </div>
            </div>

            <aside className="saramin-section p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">기업회원 서비스</h2>
                <Badge kind="verified">무료</Badge>
              </div>
              <div className="space-y-2">
                <Link href={ROUTES.JOBS_NEW} className="btn-primary w-full">채용공고 등록</Link>
                <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-secondary w-full">업체 프로필 등록</Link>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs text-gray-500">
                <Link href={`${ROUTES.JOBS}?type=matching`} className="rounded border border-gray-200 px-2 py-3 hover:border-primary hover:text-primary transition-colors">
                  파트너 섭외
                </Link>
                <Link href={ROUTES.COMMUNITY_NEW} className="rounded border border-gray-200 px-2 py-3 hover:border-primary hover:text-primary transition-colors">
                  소식 공유
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-4 py-5 space-y-5">
        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="saramin-section">
            <div className="saramin-section-title flex items-center justify-between">
              <span>직무별 채용</span>
              <Link href={ROUTES.JOBS} className="text-xs font-semibold text-gray-500 hover:text-primary">전체보기</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5">
              {BUSINESS_TYPES.map((type, index) => (
                <Link
                  key={type.value}
                  href={`${ROUTES.JOBS}?businessType=${type.value}`}
                  className="group flex min-h-[82px] flex-col justify-center border-b border-r border-gray-100 px-4 py-3 hover:bg-primary-50/70 transition-colors"
                >
                  <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded text-sm font-bold ${
                    index % 3 === 0 ? 'bg-primary-50 text-primary' : index % 3 === 1 ? 'bg-accent-50 text-accent' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {type.label.charAt(0)}
                  </span>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-primary">{type.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="saramin-section">
            <div className="saramin-section-title flex items-center justify-between">
              <span>지역별 채용</span>
              <Link href={ROUTES.JOBS} className="text-xs font-semibold text-gray-500 hover:text-primary">전체보기</Link>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-4">
              {REGIONS.slice(0, 15).map((region) => (
                <Link
                  key={region.value}
                  href={`${ROUTES.JOBS}?region=${region.value}`}
                  className="rounded border border-gray-200 px-2 py-2 text-center text-sm font-semibold text-gray-700 hover:border-primary hover:bg-primary-50 hover:text-primary transition-colors"
                >
                  {region.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="saramin-section">
          <div className="saramin-section-title flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>추천 채용정보</span>
              <Badge kind="promoted">광고</Badge>
            </div>
            <Link href={ROUTES.JOBS} className="text-xs font-semibold text-gray-500 hover:text-primary">더보기</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {featuredJobs.map((job) => (
              <Link key={`${job.company}-${job.title}`} href={ROUTES.JOBS} className="grid gap-3 px-4 py-4 hover:bg-primary-50/50 transition-colors md:grid-cols-[190px_1fr_150px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">{job.company}</p>
                  <p className="mt-1 text-xs text-gray-500">{job.region}</p>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-[16px] font-bold text-gray-900">{job.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge kind="category">{job.type}</Badge>
                    <Badge kind="attr">{job.pay}</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <span className="text-xs font-semibold text-state-urgent">상시채용</span>
                  <span className="rounded border border-gray-200 px-3 py-1.5 text-xs font-bold text-primary">상세보기</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="saramin-section">
            <div className="saramin-section-title flex items-center justify-between">
              <span>추천 업체</span>
              <Link href={ROUTES.DIRECTORY} className="text-xs font-semibold text-gray-500 hover:text-primary">더보기</Link>
            </div>
            <div className="grid gap-0 sm:grid-cols-2">
              {partnerCompanies.map((company) => (
                <Link key={company.name} href={ROUTES.DIRECTORY} className="flex gap-3 border-b border-r border-gray-100 p-4 hover:bg-primary-50/50 transition-colors">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-lg font-bold text-primary">
                    {company.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-900">{company.name}</span>
                    <span className="mt-1 block text-xs text-gray-500">{company.type} · {company.region}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-gray-500">{company.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="saramin-section">
            <div className="saramin-section-title flex items-center justify-between">
              <span>커뮤니티 인기글</span>
              <Link href={ROUTES.COMMUNITY} className="text-xs font-semibold text-gray-500 hover:text-primary">더보기</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {posts.length > 0 ? posts.map((post) => (
                <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="block px-4 py-3 hover:bg-primary-50/50 transition-colors">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge kind="category">{getCategoryLabel(post.category)}</Badge>
                    <time className="text-xs text-gray-400">{formatRelativeTime(post.created_at)}</time>
                  </div>
                  <p className="line-clamp-1 text-sm font-bold text-gray-900">{post.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span>조회 {post.view_count.toLocaleString()}</span>
                    <span>댓글 {post.comment_count ?? 0}</span>
                  </div>
                </Link>
              )) : (
                <div className="px-4 py-10 text-center text-sm text-gray-400">아직 커뮤니티 글이 없습니다.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, href, color }: { label: string; value: string; href: string; color: string }) {
  return (
    <Link href={href} className="rounded border border-gray-200 bg-secondary-50 px-4 py-3 hover:border-primary-300 hover:bg-white transition-colors">
      <span className="block text-xs font-semibold text-gray-500">{label}</span>
      <span className={`mt-1 block text-2xl font-bold ${color}`}>{value}</span>
    </Link>
  );
}
