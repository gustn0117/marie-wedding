import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import type { Post } from '@/types/database';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import RichTextView from '@/shared/components/RichTextView';
import PostDetailActions from '@/features/community/components/PostDetailActions';
import CommentSection from '@/features/community/components/CommentSection';
import LikeButton from '@/features/community/components/LikeButton';
import BookmarkButton from '@/features/bookmarks/components/BookmarkButton';
import ReportButton from '@/features/reports/components/ReportButton';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';
import JsonLd from '@/shared/components/JsonLd';
import { absoluteUrl, breadcrumbJsonLd, toPlainText, SITE_NAME, SITE_URL } from '@/shared/seo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

// 뷰어 무관한 글 데이터 — generateMetadata·JSON-LD·본문이 공유(요청당 1회).
const getPost = cache(async (id: string): Promise<{ post: Post; commentCount: number } | null> => {
  const supabase = createServerQueryClient();
  const { data: post } = await supabase
    .from('posts')
    .select(`*, author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS}), comments:comments!comments_post_id_fkey(count)`)
    .eq('id', id)
    .is('deleted_at', null)
    .filter('comments.deleted_at', 'is', null)
    .single();
  if (!post) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commentCount = ((post as any).comments?.[0]?.count as number) ?? 0;
  return { post: post as Post, commentCount };
});

// 공지는 Article, 일반 글은 DiscussionForumPosting.
function buildPostJsonLd(post: Post, commentCount: number): Record<string, unknown> {
  const url = absoluteUrl(`/community/${post.id}`);
  const description = toPlainText(post.content, 200);
  if (post.is_notice) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      datePublished: post.created_at,
      dateModified: post.updated_at || post.created_at,
      ...(description ? { description } : {}),
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: absoluteUrl('/og-marie.png') } },
      mainEntityOfPage: url,
      url,
    };
  }
  const author = post.author?.company_name || post.author?.contact_name || '익명';
  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: post.title,
    ...(description ? { text: description } : {}),
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    author: { '@type': 'Person', name: author },
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: post.like_count ?? 0 },
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: commentCount },
    ],
    mainEntityOfPage: url,
    url,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const base = await getPost(id);
  if (!base) return { title: '커뮤니티 글', robots: { index: false, follow: true } };
  const { post } = base;
  const title = post.title;
  const description = toPlainText(post.content, 155) || `${SITE_NAME} 웨딩 업계 커뮤니티`;
  const canonical = `/community/${post.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'article', title, description, url: canonical },
    twitter: { title, description },
  };
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const viewer = await getCurrentVerifiedProfile();
  const viewerProfileId = viewer.ok ? viewer.profileId : null;
  const viewerRole = viewer.ok ? viewer.role : null;

  const base = await getPost(id);
  if (!base) notFound();
  const commentCount = base.commentCount;

  let isLiked = false;
  if (viewerProfileId) {
    const supabase = createServerQueryClient();
    const { data: like } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', id)
      .eq('profile_id', viewerProfileId)
      .maybeSingle();
    isLiked = !!like;
  }
  const post = { ...base.post, comment_count: commentCount, is_liked: isLiked } as Post;

  return (
    <div className="max-w-[980px] mx-auto space-y-4">
      <JsonLd data={buildPostJsonLd(post, commentCount)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '커뮤니티', path: '/community' },
          { name: post.title, path: `/community/${post.id}` },
        ])}
      />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href={ROUTES.COMMUNITY} className="text-gray-500 hover:text-primary transition-colors">커뮤니티</Link>
        {post.is_notice && (
          <>
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-primary font-semibold">공지</span>
          </>
        )}
      </nav>

      {/* Post Card */}
      <article className="bg-white border-y border-gray-200 overflow-hidden">
        {/* Header */}
        <header className="p-6 md:p-8 border-b border-gray-100">
          {/* 공지 배지 ── 우측: 작성자 전용 수정/삭제 */}
          <div className="flex items-start justify-between gap-3 mb-3">
            {post.is_notice ? (
              <span className="inline-flex items-center rounded bg-primary px-2.5 py-1 text-xs font-bold text-white">공지</span>
            ) : (
              <span />
            )}
            <PostDetailActions
              postId={post.id}
              authorId={post.author_id}
              initialCanManage={
                !!viewerProfileId && (viewerProfileId === post.author_id || viewerRole === 'admin')
              }
            />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-4">{post.title}</h1>

          <div className="flex items-center gap-3">
            <ProfileAvatar
              profileImage={post.author?.profile_image}
              name={post.is_notice ? '마리에 운영팀' : (post.author?.company_name || post.author?.contact_name || '?')}
              size="sm"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {post.is_notice ? '마리에 운영팀' : (post.author?.company_name ?? post.author?.contact_name ?? '알 수 없음')}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <time>{formatRelativeTime(post.created_at)}</time>
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
        </header>

        {/* Content */}
        <div className="p-6 md:p-8">
          <RichTextView html={post.content} className="text-[15px] text-gray-700 leading-relaxed min-h-[200px]" />
        </div>

        {/* Like Button */}
        <div className="flex justify-center pb-6 md:pb-8">
          <div className="flex flex-wrap justify-center gap-2">
            <LikeButton
              postId={post.id}
              initialLiked={post.is_liked ?? false}
              initialCount={post.like_count}
              canLike={!!viewerProfileId}
              viewerProfileId={viewerProfileId}
            />
            <BookmarkButton targetType="post" targetId={post.id} label="글 저장" />
            <ReportButton targetType="post" targetId={post.id} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-secondary-50">
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
            <span>댓글 {commentCount}</span>
            <span>·</span>
            <span>좋아요 {post.like_count}</span>
          </div>
        </div>
      </article>

      <CommentSection
        postId={post.id}
        postAuthorId={post.author_id}
        adoptedCommentId={post.adopted_comment_id}
        initialAuthenticated={!!viewerProfileId}
      />
    </div>
  );
}
