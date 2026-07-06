import { createServerQueryClient } from '@/lib/supabase/server-query';
import type { Event, Job, Post, Profile } from '@/types/database';
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';
import HomeContent from '@/features/home/HomeContent';
import HeroBanner from '@/features/home/HeroBanner';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Marié - 웨딩 업계 구인구직 플랫폼',
  description: '웨딩 업계 종사자와 업체를 위한 채용, 프로필, 커뮤니티 플랫폼',
};

async function getHomeData() {
  const supabase = createServerQueryClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [postsRes, jobsRes, profilesRes, eventsRes, verifiedCountRes, recentJobsCountRes, featuredJobsRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*, author:profiles!author_id(*), comments:comments(count)', { count: 'exact' })
      .is('deleted_at', null)
      .filter('comments.deleted_at', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, 4),
    supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)', { count: 'exact' })
      .is('deleted_at', null)
      .eq('hidden_by_admin', false)
      .eq('posting_type', 'hiring')
      .order('created_at', { ascending: false })
      .range(0, 5),
    supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .eq('is_directory_listed', true)
      .order('company_name', { ascending: true })
      .range(0, 5),
    // 홈 '다가오는 행사' — end_date 가 오늘 이후이거나, end_date 가 없고 start_date 가 오늘 이후이거나,
    // 둘 다 없는 상시 행사만 노출. 종료된 행사는 제외.
    supabase
      .from('events')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .or(`end_date.gte.${todayIso},and(end_date.is.null,start_date.gte.${todayIso}),and(start_date.is.null,end_date.is.null)`)
      .order('is_pinned', { ascending: false })
      .order('start_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(0, 3),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('verification_status', 'verified'),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('hidden_by_admin', false)
      .eq('posting_type', 'hiring')
      .gte('created_at', thirtyDaysAgo),
    // 인기 공고 — 관리자가 선정한 featured_at IS NOT NULL인 공고만
    supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)')
      .is('deleted_at', null)
      .eq('hidden_by_admin', false)
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
    jobs: (jobsRes.data ?? []) as Job[],
    featuredJobs: (featuredJobsRes.data ?? []) as Job[],
    profiles: (profilesRes.data ?? []) as Profile[],
    events: (eventsRes.data ?? []) as Event[],
    counts: {
      jobs: jobsRes.count ?? 0,
      profiles: profilesRes.count ?? 0,
      posts: postsRes.count ?? 0,
      verified: verifiedCountRes.count ?? 0,
      recentJobs: recentJobsCountRes.count ?? 0,
    },
  };
}

export default async function HomePage() {
  const { posts, jobs, featuredJobs, profiles, events, counts } = await getHomeData();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <HeroBanner />
      <HomeContent
        posts={posts}
        jobs={jobs}
        featuredJobs={featuredJobs}
        profiles={profiles}
        events={events}
        counts={counts}
      />
      <Footer />
    </div>
  );
}
