import { createServerQueryClient } from '@/lib/supabase/server-query';
import type { Job, Post, Profile } from '@/types/database';
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';
import HomeContent from '@/features/home/HomeContent';
import HeroBanner from '@/features/home/HeroBanner';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Marié - 웨딩 업계 B2B 네트워크',
  description: '웨딩 업계 종사자를 위한 채용, 네트워킹, 정보 공유 플랫폼',
};

async function getHomeData() {
  const supabase = createServerQueryClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [postsRes, jobsRes, profilesRes, verifiedCountRes, recentJobsCountRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*, author:profiles!author_id(*), comments:comments(count)', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 4),
    supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)', { count: 'exact' })
      .is('deleted_at', null)
      .eq('hidden_by_admin', false)
      .order('created_at', { ascending: false })
      .range(0, 5),
    supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .eq('is_directory_listed', true)
      .order('company_name', { ascending: true })
      .range(0, 5),
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
      .gte('created_at', thirtyDaysAgo),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (postsRes.data ?? []).map((row: any) => {
    const { comments: commentAgg, ...rest } = row;
    return { ...rest, comment_count: commentAgg?.[0]?.count ?? 0 } as Post;
  });

  return {
    posts,
    jobs: (jobsRes.data ?? []) as Job[],
    profiles: (profilesRes.data ?? []) as Profile[],
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
  const { posts, jobs, profiles, counts } = await getHomeData();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <HeroBanner />
      <HomeContent
        posts={posts}
        jobs={jobs}
        profiles={profiles}
        counts={counts}
      />
      <Footer />
    </div>
  );
}
