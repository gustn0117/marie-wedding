'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import {
  formatRelativeTime,
  getCategoryLabel,
} from '@/shared/utils/format';
import type { Post } from '@/types/database';

function BusinessIcon({ type, className = 'w-5 h-5' }: { type: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    venue: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
    dress: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    studio: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    makeup: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    planner: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    assistant: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.053M18 6.75a3 3 0 11-6 0 3 3 0 016 0zM6.75 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    other: (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
      </svg>
    ),
  };
  return <>{icons[type] || icons.other}</>;
}

interface HomeContentProps {
  posts: Post[];
}

export default function HomeContent({ posts }: HomeContentProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const banners = [
    {
      bg: 'bg-gradient-to-r from-[#1B2A4A] to-[#2E4470]',
      badge: 'Grand Open',
      title: 'Marié 서비스 오픈',
      desc: '웨딩 업계를 하나로 잇는 B2B 플랫폼이 문을 열었습니다.',
      cta: '자세히 보기',
      href: ROUTES.JOBS,
    },
    {
      bg: 'bg-gradient-to-r from-[#6B2D5B] to-[#A24D8B]',
      badge: '채용',
      title: '웨딩 업계 채용 공고',
      desc: '예식장, 드레스샵, 스튜디오 등 다양한 웨딩 분야 채용 정보를 확인하세요.',
      cta: '공고 보기',
      href: ROUTES.JOBS,
    },
    {
      bg: 'bg-gradient-to-r from-[#1a3a2a] to-[#2d6b4a]',
      badge: '업체 등록',
      title: '무료 업체 등록',
      desc: '지금 업체를 등록하고 웨딩 업계 네트워크에 참여하세요.',
      cta: '등록하기',
      href: ROUTES.SIGNUP,
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  return (
    <>
      {/* BANNER SLIDER */}
      <section className="relative w-full overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {banners.map((banner, i) => (
            <div key={i} className={`w-full shrink-0 ${banner.bg}`}>
              <div className="max-w-[1200px] mx-auto px-4 py-12 sm:py-16 flex items-center justify-between">
                <div>
                  <span className="inline-block text-[11px] font-bold text-white/90 bg-white/15 px-3 py-1 rounded-full mb-4">
                    {banner.badge}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{banner.title}</h2>
                  <p className="text-sm sm:text-base text-white/60 mb-6 max-w-md">{banner.desc}</p>
                  <Link
                    href={banner.href}
                    className="inline-block px-6 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {banner.cta}
                  </Link>
                </div>
                <div className="hidden sm:block">
                  <span className="font-serif text-7xl font-bold text-white/10">Marié</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                currentSlide === i ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        {/* Arrows */}
        <button
          onClick={() => setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={() => setCurrentSlide((prev) => (prev + 1) % banners.length)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </section>

      {/* FULL-WIDTH BANNER */}
      <section className="bg-gradient-to-r from-primary-dark via-primary to-primary-dark">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="bg-white text-primary text-xs font-bold px-2.5 py-1 rounded">Marié</span>
            <p className="text-white font-bold text-[15px] sm:text-lg">
              웨딩업계 인재를 찾고 계신가요? <span className="text-primary-200 hidden sm:inline">지금 무료로 공고를 등록하세요</span>
            </p>
          </div>
          <Link
            href={ROUTES.JOBS_NEW}
            className="shrink-0 bg-white text-primary text-sm font-semibold px-4 py-2 rounded hover:bg-gray-100 transition-colors"
          >
            공고 등록 &rarr;
          </Link>
        </div>
      </section>

      {/* PREMIUM / HOT JOBS */}
      <section className="bg-white">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-bold text-gray-900">지금 핫한 채용</h2>
              <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">AD</span>
            </div>
            <Link href={ROUTES.JOBS} className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
              더보기 &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { company: '그랜드 웨딩홀', title: '예식장 매니저 정규직 채용', type: 'venue', region: '서울 강남', employment: '정규직' },
              { company: '로즈드레스', title: '피팅 전문가 경력직 모집', type: 'dress', region: '경기 성남', employment: '정규직' },
              { company: '루미에르 스튜디오', title: '웨딩 포토그래퍼 모집', type: 'studio', region: '서울 마포', employment: '계약직' },
              { company: '블룸 메이크업', title: '시니어 메이크업 아티스트', type: 'makeup', region: '서울 청담', employment: '정규직' },
            ].map((job, i) => (
              <Link
                key={i}
                href={ROUTES.JOBS}
                className="border border-gray-200 rounded-lg p-5 hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <BusinessIcon type={job.type} className="w-4.5 h-4.5" />
                  </span>
                  <span className="text-[12px] font-semibold text-gray-500">{job.company}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-gray-800 group-hover:text-primary transition-colors leading-snug mb-3 line-clamp-2">
                  {job.title}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">{job.region}</span>
                  <span className="text-[11px] text-gray-300">|</span>
                  <span className="text-[11px] text-gray-400">{job.employment}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORY BROWSE */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-[16px] font-bold text-gray-900">업종별 채용</h2>
                <Link href={ROUTES.JOBS} className="text-[12px] text-gray-400 hover:text-primary transition-colors">더보기</Link>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-4 gap-3">
                  {BUSINESS_TYPES.map((type) => (
                    <Link
                      key={type.value}
                      href={`${ROUTES.JOBS}?business=${type.value}`}
                      className="flex flex-col items-center gap-2 py-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <span className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <BusinessIcon type={type.value} className="w-5 h-5" />
                      </span>
                      <span className="text-[12px] font-medium text-gray-600 group-hover:text-primary">{type.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-[16px] font-bold text-gray-900">지역별 채용</h2>
                <Link href={ROUTES.JOBS} className="text-[12px] text-gray-400 hover:text-primary transition-colors">더보기</Link>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map((region) => (
                    <Link
                      key={region.value}
                      href={`${ROUTES.JOBS}?region=${region.value}`}
                      className="px-3.5 py-2 text-[13px] text-gray-600 bg-gray-50 rounded hover:bg-primary-50 hover:text-primary transition-colors font-medium border border-gray-100 hover:border-primary-200"
                    >
                      {region.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMMUNITY SECTION */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-bold text-gray-900">커뮤니티</h2>
            <Link href={ROUTES.COMMUNITY} className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
              더보기 &rarr;
            </Link>
          </div>
          {posts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={ROUTES.COMMUNITY_DETAIL(post.id)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-primary bg-primary-50 px-2 py-0.5 rounded">{getCategoryLabel(post.category)}</span>
                    <span className="text-[11px] text-gray-400">{formatRelativeTime(post.created_at)}</span>
                  </div>
                  <h3 className="text-[14px] font-semibold text-gray-800 group-hover:text-primary transition-colors mb-1.5 line-clamp-1">
                    {post.title}
                  </h3>
                  <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed">
                    {post.content}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-[12px] text-gray-400">
                    <span>조회 {post.view_count}</span>
                    {post.comment_count !== undefined && post.comment_count > 0 && (
                      <>
                        <span>·</span>
                        <span>댓글 {post.comment_count}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

    </>
  );
}
