import { cookies } from 'next/headers';
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
import LikeButton from '@/features/community/components/LikeButton';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getPostData(id: string, viewerProfileId: string | null) {
  const supabase = createServerQueryClient();
  await supabase.rpc('increment_view_count', { post_id: id });

  const { data: post } = await supabase
    .from('posts')
    .select('*, author:profiles!author_id(*), comments:comments(count)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!post) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commentCount = ((post as any).comments?.[0]?.count as number) ?? 0;

  let isLiked = false;
  if (viewerProfileId) {
    const { data: like } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', id)
      .eq('profile_id', viewerProfileId)
      .maybeSingle();
    isLiked = !!like;
  }

  return { post: { ...post, comment_count: commentCount, is_liked: isLiked } as Post, commentCount };
}

export default async function PostDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  let viewerProfileId: string | null = null;
  try {
    if (profileCookie?.value) {
      viewerProfileId = JSON.parse(profileCookie.value)?.id ?? null;
    }
  } catch {}

  const result = await getPostData(params.id, viewerProfileId);
  if (!result) notFound();

  const { post, commentCount } = result;

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
                  <span className="w-px h-3 bg-gray-200" />
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                    </svg>
                    {commentCount}
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

        {/* Like Button */}
        <div className="flex justify-center pb-6 md:pb-8">
          <LikeButton
            postId={post.id}
            initialLiked={post.is_liked ?? false}
            initialCount={post.like_count}
            canLike={!!viewerProfileId}
            viewerProfileId={viewerProfileId}
          />
        </div>

        {/* Footer */}
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
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>조회 {post.view_count.toLocaleString()}</span>
            <span>·</span>
            <span>댓글 {commentCount}</span>
            <span>·</span>
            <span>좋아요 {post.like_count}</span>
          </div>
        </div>
      </article>

      <CommentSection postId={post.id} />
    </div>
  );
}
