'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { formatDate, getCategoryLabel } from '@/shared/utils/format';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { communityService } from '@/features/community/services/community-service';
import CommentSection from '@/features/community/components/CommentSection';
import type { Post } from '@/types/database';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();

  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = profile && post && profile.id === post.author_id;

  const fetchPost = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await communityService.getPostById(postId);
      setPost(data);
    } catch (err) {
      console.error('Failed to fetch post:', err);
      setError('게시글을 찾을 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleDelete = async () => {
    if (!post || !confirm('게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    setIsDeleting(true);
    try {
      await communityService.deletePost(post.id);
      router.push(ROUTES.COMMUNITY);
    } catch (err) {
      console.error('Failed to delete post:', err);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-16 bg-secondary rounded-full" />
          <div className="h-8 w-3/4 bg-secondary rounded" />
          <div className="flex gap-3">
            <div className="h-3 w-20 bg-secondary rounded" />
            <div className="h-3 w-20 bg-secondary rounded" />
          </div>
          <div className="h-px bg-border my-6" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-secondary rounded" />
            <div className="h-4 w-full bg-secondary rounded" />
            <div className="h-4 w-2/3 bg-secondary rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-3">
          {error ?? '게시글을 찾을 수 없습니다'}
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          삭제되었거나 존재하지 않는 게시글입니다.
        </p>
        <Link href={ROUTES.COMMUNITY} className="btn-primary text-sm">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back Link */}
      <Link
        href={ROUTES.COMMUNITY}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      {/* Post Header */}
      <article>
        <header className="mb-6">
          {/* Category Badge */}
          <span className="badge-primary text-xs mb-3 inline-block">
            {getCategoryLabel(post.category)}
          </span>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-snug mb-4">
            {post.title}
          </h1>

          {/* Author & Meta */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {post.author?.company_name?.[0] ?? '?'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {post.author?.company_name ?? '알 수 없음'}
                  {post.author?.contact_name && (
                    <span className="text-text-muted font-normal ml-1.5">
                      {post.author.contact_name}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
                  <span className="w-px h-3 bg-border" />
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    조회 {post.view_count}
                  </span>
                </div>
              </div>
            </div>

            {/* Author Actions */}
            {isAuthor && (
              <div className="flex items-center gap-2">
                <Link
                  href={`${ROUTES.COMMUNITY_DETAIL(post.id)}/edit`}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"
                >
                  수정
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-xs text-text-muted hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {isDeleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Divider */}
        <hr className="border-border mb-6" />

        {/* Content */}
        <div className="prose prose-sm max-w-none text-text-primary leading-relaxed whitespace-pre-wrap">
          {post.content}
        </div>
      </article>

      {/* Comments */}
      <CommentSection postId={post.id} />
    </div>
  );
}
