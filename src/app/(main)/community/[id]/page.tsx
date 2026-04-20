import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime, getCategoryLabel } from '@/shared/utils/format';
import type { Post } from '@/types/database';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import RichTextView from '@/shared/components/RichTextView';
import PostDetailActions from '@/features/community/components/PostDetailActions';
import CommentSection from '@/features/community/components/CommentSection';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getPost(id: string): Promise<Post | null> {
  const supabase = createServerQueryClient();
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href={ROUTES.COMMUNITY} className="text-gray-500 hover:text-primary transition-colors">커뮤니티</Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <Link href={`${ROUTES.COMMUNITY}?category=${post.category}`} className="text-gray-500 hover:text-primary transition-colors">
          {getCategoryLabel(post.category)}
        </Link>
      </nav>

      {/* Post Card */}
      <article className="bg-white border border-gray-200">
        {/* Header */}
        <header className="p-6 md:p-8 border-b border-gray-100">
          <span className="inline-flex items-center px-2.5 py-1 bg-primary-50 text-primary text-xs font-semibold mb-3">
            {getCategoryLabel(post.category)}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-4">{post.title}</h1>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                profileImage={post.author?.profile_image}
                name={post.author?.company_name || post.author?.contact_name || '?'}
                size="sm"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {post.author?.company_name ?? post.author?.contact_name ?? '알 수 없음'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <time>{formatRelativeTime(post.created_at)}</time>
                  <span className="w-px h-3 bg-gray-200" />
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {post.view_count.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <PostDetailActions postId={post.id} authorId={post.author_id} />
          </div>
        </header>

        {/* Content */}
        <div className="p-6 md:p-8">
          <RichTextView html={post.content} className="text-[15px] text-gray-700 leading-relaxed min-h-[200px]" />
        </div>

        {/* Footer - Share & Back */}
        <div className="px-6 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <Link
            href={ROUTES.COMMUNITY}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />
            </svg>
            목록으로
          </Link>
          <p className="text-xs text-gray-400">조회 {post.view_count.toLocaleString()}회</p>
        </div>
      </article>

      {/* Comments */}
      <CommentSection postId={post.id} />
    </div>
  );
}
