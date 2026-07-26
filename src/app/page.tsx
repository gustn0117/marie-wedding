import { createServerQueryClient } from '@/lib/supabase/server-query';
import { PUBLIC_JOB_COLUMNS } from '@/shared/constants/jobSelect';
import { todayKstIso } from '@/shared/utils/kstDate';
import type { Event, Job, Post, Profile } from '@/types/database';
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';
import HomeContent from '@/features/home/HomeContent';
import HeroBanner from '@/features/home/HeroBanner';
import JsonLd from '@/shared/components/JsonLd';
import { SITE_URL, SITE_NAME, SITE_NAME_KO, SITE_DESCRIPTION, absoluteUrl } from '@/shared/seo';

export const dynamic = 'force-dynamic';

// title/description 는 루트 layout.tsx 기본값 상속. canonical 만 홈 자신으로 명시.
export const metadata = {
  alternates: { canonical: '/', types: { 'application/rss+xml': '/rss.xml' } },
};

// 사이트 전역 구조화 데이터 — 브랜드 인지 + 사이트링크 검색창(SearchAction).
const SITE_JSONLD: Record<string, unknown>[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: `${SITE_NAME_KO} ${SITE_NAME}`,
    alternateName: ['마리에', 'Marié', 'Marie', 'marie.co.kr'],
    url: SITE_URL,
    inLanguage: 'ko-KR',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: `${SITE_NAME_KO} ${SITE_NAME}`,
    alternateName: '마리에',
    url: SITE_URL,
    logo: absoluteUrl('/og-marie.png'),
    image: absoluteUrl('/og-marie.png'),
    description: SITE_DESCRIPTION,
    email: 'admin@marie.co.kr',
    areaServed: 'KR',
  },
];

// 공개 홈('/'는 middleware public path)은 비로그인 방문자도 접근 가능하다.
// 서버→클라이언트 컴포넌트 경계로 넘기는 profiles 객체는 화면 렌더 여부와 무관하게
// RSC flight 페이로드로 통째로 직렬화돼 초기 HTML에 실린다. 따라서 select('*') 대신
// 공개 안전 컬럼만 화이트리스트한다 (business_number·admin_note·verification_document·
// phone·naver_sub 등 민감 컬럼 노출 차단).
const PUBLIC_PROFILE_COLS =
  'id, company_name, contact_name, business_type, region, profile_image, verification_status, completed_deals_count, premium_tier';

async function getHomeData() {
  const supabase = createServerQueryClient();
  const todayIso = todayKstIso();

  // 홈은 목록 6~4행만 보여주고 총개수(count)는 화면에 렌더하지 않는다. 과거 count:'exact'
  // 5회가 매 요청 활성행 전체를 카운트 스캔해 성장 시 공유 Postgres CPU를 잡아먹었다.
  // 사문화된 counts 라 카운트 자체를 제거 → 목록 쿼리는 인덱스에서 6행만 읽고 멈춘다.
  const [postsRes, jobsRes, profilesRes, eventsRes, featuredJobsRes, featuredProfilesRes] = await Promise.all([
    supabase
      .from('posts')
      .select(`*, author:profiles!author_id(${PUBLIC_PROFILE_COLS}), comments:comments!comments_post_id_fkey(count)`)
      .is('deleted_at', null)
      .filter('comments.deleted_at', 'is', null)
      .order('is_notice', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, 4),
    supabase
      .from('jobs')
      .select(`${PUBLIC_JOB_COLUMNS}, author:profiles!author_id(${PUBLIC_PROFILE_COLS})`)
      .is('deleted_at', null)
      .eq('hidden_by_admin', false)
      .neq('status', 'hidden')
      .eq('posting_type', 'hiring')
      .order('created_at', { ascending: false })
      .range(0, 5),
    supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLS)
      .is('deleted_at', null)
      .eq('is_directory_listed', true)
      .order('created_at', { ascending: false })
      .range(0, 5),
    // 홈 '다가오는 행사' — end_date 가 오늘 이후이거나, end_date 가 없고 start_date 가 오늘 이후이거나,
    // 둘 다 없는 상시 행사만 노출. 종료된 행사는 제외.
    supabase
      .from('events')
      .select('*')
      .is('deleted_at', null)
      .or(`end_date.gte.${todayIso},and(end_date.is.null,start_date.gte.${todayIso}),and(start_date.is.null,end_date.is.null)`)
      .order('is_pinned', { ascending: false })
      .order('start_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(0, 3),
    // 인기 공고 — 관리자가 선정한 featured_at IS NOT NULL인 공고만
    supabase
      .from('jobs')
      .select(`${PUBLIC_JOB_COLUMNS}, author:profiles!author_id(${PUBLIC_PROFILE_COLS})`)
      .is('deleted_at', null)
      .eq('hidden_by_admin', false)
      .neq('status', 'hidden')
      .not('featured_at', 'is', null)
      .order('featured_order', { ascending: true })
      .order('featured_at', { ascending: false })
      .limit(20),
    // 추천 프로필 — 관리자가 지정한 featured_at IS NOT NULL 프로필만
    supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLS)
      .is('deleted_at', null)
      .eq('is_directory_listed', true)
      .not('featured_at', 'is', null)
      .order('featured_order', { ascending: true })
      .order('featured_at', { ascending: false })
      .limit(20),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (postsRes.data ?? []).map((row: any) => {
    const { comments: commentAgg, ...rest } = row;
    return { ...rest, comment_count: commentAgg?.[0]?.count ?? 0 } as Post;
  });

  return {
    posts,
    jobs: (jobsRes.data ?? []) as unknown as Job[],
    featuredJobs: (featuredJobsRes.data ?? []) as unknown as Job[],
    featuredProfiles: (featuredProfilesRes.data ?? []) as Profile[],
    profiles: (profilesRes.data ?? []) as Profile[],
    events: (eventsRes.data ?? []) as Event[],
  };
}

// 홈 데이터는 전원에게 동일한 공개 데이터(개인화 없음) → 30초 캐싱으로
// 1,000 동시접속 시 매 요청 7쿼리 대신 30초당 1회 채움으로 DB 부하를 줄인다.
// 개인화(로그인 헤더)는 별도 컴포넌트(쿠키 기반)라 캐싱 영향 없음.
// 홈은 force-dynamic 으로 매 요청 최신 조회. 이전엔 unstable_cache(30초)를 썼으나
// 멀티워커(클러스터)마다 in-memory 캐시가 달라 '새로고침마다 공고가 떴다 사라졌다'
// 하던 문제가 있어 제거. 쿼리는 내부 kong 직결 + 인덱스라 매 요청 조회해도 빠르다.

export default async function HomePage() {
  const { posts, jobs, featuredJobs, featuredProfiles, profiles, events } = await getHomeData();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <JsonLd data={SITE_JSONLD} />
      <Header />
      <HeroBanner />
      <HomeContent
        posts={posts}
        jobs={jobs}
        featuredJobs={featuredJobs}
        featuredProfiles={featuredProfiles}
        profiles={profiles}
        events={events}
      />
      <Footer />
    </div>
  );
}
