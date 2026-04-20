'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import { formatRelativeTime } from '@/shared/utils/format';
import { useAuth } from '@/shared/hooks/useAuth';
import { communityService } from '../services/community-service';
import type { Comment } from '@/types/database';

interface CommentSectionProps {
  postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const { profile } = useAuth();

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
      const newComment = await communityService.createComment(postId, content.trim(), profile.id);
      setComments((prev) => [...prev, newComment]);
      setContent('');
    } catch (err) {
      console.error(err);
      alert('댓글 작성에 실패했습니다.');
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
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="bg-white border border-gray-200">
      <header className="px-6 md:px-8 py-4 border-b border-gray-100 flex items-center gap-2">
        <h3 className="text-base font-bold text-gray-900">댓글</h3>
        <span className="text-sm font-bold text-primary">{comments.length}</span>
      </header>

      {/* Input (상단으로 이동) */}
      <div className="px-6 md:px-8 py-5 border-b border-gray-100 bg-gray-50">
        {profile ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex items-start gap-3">
              <ProfileAvatar
                profileImage={profile.profile_image}
                name={profile.company_name || profile.contact_name}
                size="sm"
              />
              <div className="flex-1">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="댓글을 입력해주세요"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-400">{content.length}자</p>
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="px-5 py-2 bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '등록 중...' : '댓글 등록'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">댓글을 작성하려면 로그인이 필요합니다.</p>
            <Link href={ROUTES.LOGIN} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">
              로그인하기
            </Link>
          </div>
        )}
      </div>

      {/* Comments List */}
      <div className="px-6 md:px-8 py-2">
        {loading ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 py-2">
                <div className="w-9 h-9 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                  <div className="h-4 w-full bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {comments.map((comment) => (
              <li key={comment.id} className="py-4 flex gap-3">
                <ProfileAvatar
                  profileImage={comment.author?.profile_image}
                  name={comment.author?.company_name || comment.author?.contact_name || '?'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {comment.author?.company_name ?? comment.author?.contact_name ?? '알 수 없음'}
                      </span>
                      <time className="text-xs text-gray-400">{formatRelativeTime(comment.created_at)}</time>
                    </div>
                    {profile?.id === comment.author_id && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {deletingId === comment.id ? '삭제 중...' : '삭제'}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
