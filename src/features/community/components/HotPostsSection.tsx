import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime, getCategoryLabel } from '@/shared/utils/format';
import type { Post } from '@/types/database';

const WINDOW_DAYS = 14;

interface ScoredPost extends Post {
  score: number;
}

export default async function HotPostsSection() {
  const supabase = createServerQueryClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('posts')
    .select('*, author:profiles!author_id(id, company_name, contact_name)')
    .is('deleted_at', null)
    .gte('created_at', since)
    .order('like_count', { ascending: false })
    .limit(50);

  const posts = ((data ?? []) as Post[]).map((p) => {
    const score = p.like_count * 3 + Math.floor(p.view_count / 10);
    return { ...p, score } as ScoredPost;
  });
  posts.sort((a, b) => b.score - a.score);
  const top = posts.filter((p) => p.score > 0).slice(0, 5);

  if (top.length === 0) return null;

  return (
    <section className="platform-panel">
      <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Trending</p>
          <h2 className="text-sm font-bold text-gray-900 mt-0.5">최근 {WINDOW_DAYS}일 인기글</h2>
        </div>
        <Link href={`${ROUTES.COMMUNITY}?sort=popular`} className="text-xs font-bold text-gray-500 hover:text-ink">
          전체 →
        </Link>
      </div>
      <ol className="divide-y divide-gray-100">
        {top.map((post, i) => (
          <li key={post.id}>
            <Link
              href={ROUTES.COMMUNITY_DETAIL(post.id)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <span className={`shrink-0 w-6 text-center text-base font-extrabold tabular-nums ${i < 3 ? 'text-primary' : 'text-gray-400'}`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                    {getCategoryLabel(post.category)}
                  </span>
                  <p className="text-sm font-bold text-ink group-hover:text-primary truncate">
                    {post.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 tabular-nums">
                  <span>♥ {post.like_count}</span>
                  <span>조회 {post.view_count.toLocaleString()}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(post.created_at)}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
