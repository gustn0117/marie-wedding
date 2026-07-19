'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import { formatRelativeTime } from '@/shared/utils/format';
import { withTimeout } from '@/shared/utils/withTimeout';
import { useAuth } from '@/shared/hooks/useAuth';
import { communityService } from '../services/community-service';
import type { Comment } from '@/types/database';
import { toast, toastConfirm } from '@/shared/components/Toast';
import { createClient } from '@/lib/supabase/client';

interface CommentSectionProps {
  postId: string;
  postAuthorId: string | null;
  adoptedCommentId?: string | null;
  /** SSR 에서 marie_profile cookie 로 판정한 로그인 여부 — hydration flash 방지 */
  initialAuthenticated?: boolean;
}

export default function CommentSection({ postId, postAuthorId, adoptedCommentId: initialAdopted, initialAuthenticated = false }: CommentSectionProps) {
  const router = useRouter();
  const { profile, isLoading } = useAuth();
  // useAuth 가 아직 로딩중이면 SSR prop 을 신뢰 (로그인 CTA vs 폼 flash 방지)
  const isAuthenticated = profile ? true : (isLoading ? initialAuthenticated : false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createIdRef = useRef<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adoptedId, setAdoptedId] = useState<string | null>(initialAdopted ?? null);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const isPostAuthor = profile?.id === postAuthorId;

  const adopt = useCallback(async (commentId: string | null) => {
    setAdoptingId(commentId ?? 'reset');
    try {
      const sb = createClient();
      const { error } = await withTimeout(sb.rpc('set_adopted_comment', {
        p_post_id: postId,
        p_comment_id: commentId,
      }), 10000);
      if (error) throw error;
      setAdoptedId(commentId);
      toast(commentId ? '댓글을 채택했습니다.' : '채택을 취소했습니다.', 'success');
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? '';
      let userMsg = '채택 처리에 실패했습니다.';
      if (msg.includes('cannot_adopt_own_comment')) userMsg = '자신의 댓글은 채택할 수 없습니다.';
      else if (msg.includes('comment_post_mismatch')) userMsg = '다른 글의 댓글은 채택할 수 없습니다.';
      else if (msg.includes('post_not_found_or_not_author')) userMsg = '권한이 없습니다.';
      else if (msg.includes('comment_not_found')) userMsg = '댓글을 찾을 수 없습니다.';
      toast(userMsg, 'error');
    } finally {
      setAdoptingId(null);
    }
  }, [postId]);

  const fetchComments = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await withTimeout(communityService.getComments(postId), 10000, '댓글 조회 지연');
      setComments(data);
    } catch (err) {
      // 조회 실패를 삼키면 "댓글 없음"으로 오인돼 있던 댓글이 사라진 것처럼 보인다. 에러 상태로 구분.
      console.error('Failed to fetch comments:', err);
      setLoadError(true);
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
      const createId = createIdRef.current ?? crypto.randomUUID();
      createIdRef.current = createId;
      const newComment = await withTimeout(communityService.createComment(postId, content.trim(), createId), 12000);
      setComments((prev) => [...prev, newComment]);
      router.refresh(); // 상세 헤더/푸터 SSR 댓글 수 동기화
      setContent('');
      createIdRef.current = null;
    } catch (err) {
      console.error(err);
      toast('댓글 작성에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const ok = await toastConfirm('댓글을 삭제하시겠습니까?');
    if (!ok) return;
    setDeletingId(commentId);
    try {
      await withTimeout(communityService.deleteComment(commentId), 10000, '댓글 삭제 지연');
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      router.refresh(); // 상세 헤더/푸터 SSR 댓글 수 동기화
      toast('삭제되었습니다.', 'success');
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // sort: adopted comment first
  const sortedComments = [...comments].sort((a, b) => {
    if (a.id === adoptedId) return -1;
    if (b.id === adoptedId) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <section className="bg-white border-y border-gray-200 overflow-hidden">
      <header className="px-6 md:px-8 py-4 border-b border-gray-100 flex items-center gap-2">
        <h3 className="text-base font-bold text-gray-900">댓글</h3>
        <span className="text-sm font-bold text-primary">{comments.length}</span>
      </header>

      {/* Input (상단으로 이동) */}
      <div className="px-6 md:px-8 py-5 border-b border-gray-100 bg-secondary-50">
        {isLoading && !profile ? (
          // useAuth 확정 전 — SSR prop 기준으로 skeleton 대체
          isAuthenticated ? (
            <div className="animate-pulse space-y-2">
              <div className="h-20 rounded bg-white border border-gray-200" />
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">댓글을 작성하려면 로그인이 필요합니다.</p>
              <Link href={ROUTES.LOGIN} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-dark transition-colors">
                로그인하기
              </Link>
            </div>
          )
        ) : profile ? (
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-400">{content.length}자</p>
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="px-5 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '등록 중...' : '댓글 등록'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">댓글을 작성하려면 로그인이 필요합니다.</p>
            <Link href={ROUTES.LOGIN} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-dark transition-colors">
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
        ) : loadError ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">댓글을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => { setLoading(true); fetchComments(); }}
              className="mt-2 text-sm font-bold text-primary hover:underline"
            >
              다시 시도
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedComments.map((comment) => {
              const isAdopted = comment.id === adoptedId;
              const canAdopt = isPostAuthor && comment.author_id !== postAuthorId;
              return (
                <li key={comment.id} className={`py-4 flex gap-3 ${isAdopted ? '-mx-6 md:-mx-8 px-6 md:px-8 bg-gray-50 border-l-4 border-l-primary' : ''}`}>
                  <ProfileAvatar
                    profileImage={comment.author?.profile_image}
                    name={comment.author?.company_name || comment.author?.contact_name || '?'}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAdopted && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded">
                            <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>채택</span>
                          </span>
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {comment.author?.company_name ?? comment.author?.contact_name ?? '알 수 없음'}
                        </span>
                        <time className="text-xs text-gray-400">{formatRelativeTime(comment.created_at)}</time>
                      </div>
                      <div className="flex items-center gap-2">
                        {canAdopt && !isAdopted && adoptedId === null && (
                          <button
                            onClick={() => adopt(comment.id)}
                            disabled={adoptingId !== null}
                            className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
                          >
                            채택하기
                          </button>
                        )}
                        {isPostAuthor && isAdopted && (
                          <button
                            onClick={() => adopt(null)}
                            disabled={adoptingId !== null}
                            className="text-xs text-gray-500 hover:text-state-urgent disabled:opacity-50"
                          >
                            채택 해제
                          </button>
                        )}
                        {profile?.id === comment.author_id && (
                          <button
                            onClick={() => handleDelete(comment.id)}
                            disabled={deletingId === comment.id}
                            className="text-xs text-gray-400 hover:text-state-urgent transition-colors disabled:opacity-50"
                          >
                            {deletingId === comment.id ? '삭제 중...' : '삭제'}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
