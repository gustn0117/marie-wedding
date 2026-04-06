import { createServerQueryClient } from '@/lib/supabase/server-query';
import type { Post } from '@/types/database';
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';
import HomeContent from '@/features/home/HomeContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Marié - 웨딩 업계 B2B 네트워크',
  description: '웨딩 업계 종사자를 위한 채용, 네트워킹, 정보 공유 플랫폼',
};

async function getHomeData() {
  const supabase = createServerQueryClient();

  const postsRes = await supabase
    .from('posts')
    .select('*, author:profiles!author_id(*), comments:comments(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(0, 2);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (postsRes.data ?? []).map((row: any) => {
    const { comments: commentAgg, ...rest } = row;
    return { ...rest, comment_count: commentAgg?.[0]?.count ?? 0 } as Post;
  });

  return { posts };
}

export default async function HomePage() {
  const { posts } = await getHomeData();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <HomeContent posts={posts} />
      <Footer />
    </div>
  );
}
