import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { formatDate, getCategoryLabel } from '@/shared/utils/format';
import type { Post } from '@/types/database';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import PostDetailActions from '@/features/community/components/PostDetailActions';
import CommentSection from '@/features/community/components/CommentSection';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getPost(id: string): Promise<Post | null> {
  const supabase = createServerQueryClient();

  // Increment view count
  await supabase.rpc('increment_view_count', { post_id: id });

  const { data } = await supabase
    .from('posts')
    .select('*, author:profiles!author_id(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  return data as Post | null;
}

export default async function PostDetailPage({ params }: PageProps) {
  const post = await getPost(params.id);
  if (!post) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={ROUTES.COMMUNITY}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      <article>
        <header className="mb-6">
          <span className="badge-primary text-xs mb-3 inline-block">{getCategoryLabel(post.category)}</span>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-4">{post.title}</h1>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <ProfileAvatar profileImage={post.author?.profile_image} name={post.author?.company_name || post.author?.contact_name || '?'} size="sm" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {post.author?.company_name ?? post.author?.contact_name ?? '알 수 없음'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <time>{formatDate(post.created_at)}</time>
                  <span className="w-px h-3 bg-gray-200" />
                  <span>조회 {post.view_count}</span>
                </div>
              </div>
            </div>
            <PostDetailActions postId={post.id} authorId={post.author_id} />
          </div>
        </header>

        <hr className="border-gray-100 mb-6" />

        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</div>
      </article>

      <CommentSection postId={post.id} />
    </div>
  );
}
