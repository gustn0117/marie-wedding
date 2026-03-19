'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { communityService } from '../services/community-service';
import type { Comment } from '@/types/database';

interface CommentSectionProps {
  postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const { user, profile, loading: authLoading } = useAuth();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const data = await communityService.getComments(postId);
      setComments(data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !profile) return;

    setIsSubmitting(true);
    try {
      const newComment = await communityService.createComment(
        postId,
        content.trim(),
        profile.id,
      );
      setComments((prev) => [...prev, newComment]);
      setContent('');
    } catch (err) {
      console.error('Failed to create comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    setDeletingId(commentId);
    try {
      await communityService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mt-10">
      {/* Header */}
      <h3 className="font-serif text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
        댓글
        <span className="text-sm font-normal text-text-muted">
          {comments.length}
        </span>
      </h3>

      {/* Comments List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse py-4 border-b border-border">
              <div className="h-3 w-24 bg-secondary rounded mb-2" />
              <div className="h-4 w-3/4 bg-secondary rounded" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">
          아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
        </p>
      ) : (
        <div className="divide-y divide-border">
          {comments.map((comment) => (
            <div key={comment.id} className="py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* Avatar Placeholder */}
                  <div className="w-7 h-7 rounded-full bg-primary-50 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {comment.author?.company_name?.[0] ?? '?'}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {comment.author?.company_name ?? '알 수 없음'}
                  </span>
                  <time className="text-xs text-text-muted">
                    {formatRelativeTime(comment.created_at)}
                  </time>
                </div>

                {/* Delete Button */}
                {profile?.id === comment.author_id && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    className="text-xs text-text-muted hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deletingId === comment.id ? '삭제 중...' : '삭제'}
                  </button>
                )}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed pl-9">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Comment Input */}
      <div className="mt-6 pt-6 border-t border-border">
        {authLoading ? null : user && profile ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="댓글을 입력해주세요"
              className="input-field resize-none"
              rows={3}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="btn-primary text-sm"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    등록 중...
                  </span>
                ) : (
                  '댓글 등록'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6 bg-secondary/50 rounded-lg">
            <p className="text-sm text-text-secondary mb-3">
              댓글을 작성하려면 로그인이 필요합니다.
            </p>
            <Link href={ROUTES.LOGIN} className="btn-primary text-sm">
              로그인하기
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
