'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';

/* ───────────────── Mock Data ───────────────── */

const mockJobs = [
  { id: '1', title: '웨딩홀 매니저 모집 (경력 3년 이상)', company: '그랜드 웨딩홀', region: '서울', type: '정규직', deadline: '~03.31(월)', logo: '🏛️' },
  { id: '2', title: '드레스 피팅 전문가 채용', company: '로즈드레스', region: '경기', type: '정규직', deadline: '~04.05(토)', logo: '👗' },
  { id: '3', title: '웨딩 포토그래퍼 모집', company: '루미에르 스튜디오', region: '서울', type: '계약직', deadline: 'D-5', logo: '📸' },
  { id: '4', title: '메이크업 아티스트 각 부문 채용', company: '뷰티앤브라이드', region: '부산', type: '업체 섭외', deadline: '~03.31', logo: '💄' },
];

const mockPlatinumJobs = [
  { id: '10', title: '2026 상반기 각 부문 신입/경력 채용', company: '더클래식 웨딩', logo: '🏛️', deadline: '~04.05(토)' },
  { id: '11', title: '드레스 디자이너 경력직 수시채용', company: '아뜰리에 로사', logo: '👗', deadline: '~04.15(화)' },
  { id: '12', title: '스튜디오 운영팀 정규직 채용 (전국)', company: '빛나는스튜디오', logo: '📸', deadline: '~04.10(목)' },
  { id: '13', title: '2026 부문별 채용 [신입/경력]', company: '웨딩파크', logo: '🏛️', deadline: '~04.20(일)' },
];

const toolButtons = [
  { icon: '📝', label: '이력서 작성' },
  { icon: '🔍', label: '맞춤 채용' },
  { icon: '💰', label: '연봉 정보' },
];

const sideNavItems = [
  { label: '추천공고', href: ROUTES.JOBS },
  { label: '주요 채용소식', href: ROUTES.JOBS },
  { label: '업체정보', href: ROUTES.DIRECTORY },
  { label: '커뮤니티', href: ROUTES.COMMUNITY },
];

/* ───────────────── Tabs for Center ───────────────── */
const centerTabs = [
  { key: 'recommend', label: '회원님을 위한 추천공고', icon: '✨' },
  { key: 'hot', label: '지금 핫한 채용 공고', icon: '🔥' },
  { key: 'urgent', label: '업체 섭외 공고', icon: '⚡' },
];

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('recommend');

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* ═══════════════ MAIN 3-COLUMN SECTION ═══════════════ */}
      <section className="bg-white">
        <div className="max-w-[1200px] mx-auto px-4 py-6">
          {/* Section Title */}
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-[18px] font-bold text-gray-900">오늘의 웨딩업계 소식</h2>
          </div>

          <div className="flex gap-5">
            {/* ─── Left Column (240px) ─── */}
            <div className="hidden lg:block w-[240px] shrink-0 space-y-3">
              {/* Tip Card */}
              <div className="bg-gray-100 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">💡</span>
                  <p className="text-[13px] text-gray-700 leading-snug font-medium">
                    놓치면 후회할 합격률 높은 공고를 준비했어요.
                  </p>
                </div>
                <button
                  onClick={() => router.push(ROUTES.JOBS)}
                  className="w-full py-2 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200 transition-colors"
                >
                  확인하기
                </button>
              </div>

              {/* Quick Info Links */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <Link href={ROUTES.DIRECTORY} className="flex items-center gap-2.5 text-[13px] text-gray-600 hover:text-primary transition-colors group">
                  <span className="text-lg">🏢</span>
                  <span className="group-hover:underline">업체 디렉토리 바로가기</span>
                  <svg className="w-3 h-3 ml-auto text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
                <Link href={ROUTES.COMMUNITY} className="flex items-center gap-2.5 text-[13px] text-gray-600 hover:text-primary transition-colors group">
                  <span className="text-lg">💬</span>
                  <span className="group-hover:underline">커뮤니티 인기글 보기</span>
                  <svg className="w-3 h-3 ml-auto text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
                <Link href={`${ROUTES.JOBS}?type=matching`} className="flex items-center gap-2.5 text-[13px] text-gray-600 hover:text-primary transition-colors group">
                  <span className="text-lg">🔥</span>
                  <span className="group-hover:underline">업체 섭외 공고 모아보기</span>
                  <svg className="w-3 h-3 ml-auto text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* ─── Center Column (flex-1) ─── */}
            <div className="flex-1 min-w-0">
              {/* Tabs */}
              <div className="flex items-center border-b border-gray-200 mb-0">
                {centerTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'text-primary border-primary'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Job Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border border-gray-200 rounded-b-lg overflow-hidden">
                {mockJobs.map((job, idx) => (
                  <Link
                    key={job.id}
                    href={ROUTES.JOBS_DETAIL(job.id)}
                    className={`flex flex-col p-5 hover:bg-blue-50/40 transition-colors group ${
                      idx < mockJobs.length - 1 ? 'border-r border-b border-gray-100' : ''
                    }`}
                  >
                    {/* Company Logo */}
                    <div className="text-3xl mb-3">{job.logo}</div>
                    {/* Job Title */}
                    <h3 className="text-[14px] font-semibold text-gray-800 group-hover:text-primary transition-colors leading-snug mb-2 line-clamp-2">
                      {job.title}
                    </h3>
                    {/* Company */}
                    <p className="text-[13px] text-gray-500 mb-auto">{job.company}</p>
                    {/* Deadline */}
                    <p className="text-[12px] text-gray-400 mt-3">{job.deadline}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* ─── Right Column (280px) ─── */}
            <div className="hidden xl:block w-[280px] shrink-0 space-y-4">
              {/* Event Banner */}
              <div className="bg-gradient-to-br from-primary to-primary-dark rounded-xl p-5 text-white relative overflow-hidden">
                <span className="absolute top-3 left-3 text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                  이벤트
                </span>
                <div className="pt-5">
                  <h3 className="text-[18px] font-bold leading-tight mb-1">
                    무료 공고 등록
                  </h3>
                  <p className="text-[13px] text-primary-200 mb-3">
                    지금 공고 등록하면<br />첫 달 무료!
                  </p>
                </div>
              </div>

              {/* Tool Buttons */}
              <div className="flex gap-2">
                {toolButtons.map((tool) => (
                  <button
                    key={tool.label}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
                  >
                    <span className="text-xl">{tool.icon}</span>
                    <span className="text-[11px] font-medium text-gray-600">{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Floating Side Nav (far right) ─── */}
          <div className="hidden 2xl:fixed 2xl:block right-[calc((100vw-1200px)/2-80px)] top-[200px] w-[68px]">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {sideNavItems.map((item, idx) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block px-2 py-2.5 text-[11px] text-center text-gray-500 hover:text-primary hover:bg-gray-50 transition-colors ${
                    idx < sideNavItems.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="block w-full px-2 py-2.5 text-[11px] text-center text-gray-400 hover:text-primary border-t border-gray-100 transition-colors"
              >
                TOP
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FULL-WIDTH BANNER ═══════════════ */}
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

      {/* ═══════════════ PLATINUM JOBS ═══════════════ */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-bold text-gray-900">
              회원님이 꼭 봐야 할 공고
              <span className="text-primary ml-1.5 text-[13px] font-semibold">(추천)</span>
            </h2>
            <Link href={ROUTES.JOBS} className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
              더보기 &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockPlatinumJobs.map((job) => (
              <Link
                key={job.id}
                href={ROUTES.JOBS_DETAIL(job.id)}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
              >
                {/* Top area with logo */}
                <div className="bg-gray-50 flex items-center justify-center py-8 border-b border-gray-100">
                  <span className="text-5xl">{job.logo}</span>
                </div>
                {/* Info */}
                <div className="p-4">
                  <h3 className="text-[14px] font-semibold text-gray-800 group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-1.5">
                    {job.title}
                  </h3>
                  <p className="text-[13px] text-gray-500">{job.company}</p>
                  <p className="text-[12px] text-gray-400 mt-2">{job.deadline}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CATEGORY BROWSE ═══════════════ */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 업종별 채용 */}
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
                      <span className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary text-lg group-hover:bg-primary group-hover:text-white transition-colors">
                        {type.value === 'venue' ? '🏛️' :
                         type.value === 'dress' ? '👗' :
                         type.value === 'studio' ? '📸' :
                         type.value === 'makeup' ? '💄' :
                         type.value === 'planner' ? '📋' :
                         type.value === 'assistant' ? '🤝' : '📦'}
                      </span>
                      <span className="text-[12px] font-medium text-gray-600 group-hover:text-primary">{type.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* 지역별 채용 */}
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

      {/* ═══════════════ COMMUNITY SECTION ═══════════════ */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-bold text-gray-900">커뮤니티</h2>
            <Link href={ROUTES.COMMUNITY} className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
              더보기 &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: '1', title: '2026 상반기 웨딩 트렌드 정리', category: '업계뉴스', comments: 12, date: '03.19', preview: '올해 상반기 웨딩 시장의 주요 트렌드를 정리해봤습니다. 소규모 웨딩과 아웃도어 웨딩이...' },
              { id: '2', title: '신규 웨딩홀 입점 시 체크리스트', category: '노하우공유', comments: 8, date: '03.18', preview: '새 웨딩홀 입점 시 반드시 확인해야 할 사항들을 정리했습니다...' },
              { id: '3', title: '메이크업 아티스트 워크샵 후기', category: '자유게시판', comments: 15, date: '03.18', preview: '지난주 진행된 메이크업 워크샵 후기입니다. 트렌드 메이크업 기법을...' },
            ].map((post) => (
              <Link
                key={post.id}
                href={ROUTES.COMMUNITY_DETAIL(post.id)}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-primary bg-primary-50 px-2 py-0.5 rounded">{post.category}</span>
                  <span className="text-[11px] text-gray-400">{post.date}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-gray-800 group-hover:text-primary transition-colors mb-1.5 line-clamp-1">
                  {post.title}
                </h3>
                <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed">
                  {post.preview}
                </p>
                <div className="flex items-center gap-1 mt-3 text-[12px] text-gray-400">
                  <span>💬</span>
                  <span>{post.comments}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
