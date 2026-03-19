'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { communityService } from '@/features/community/services/community-service';
import PostForm from '@/features/community/components/PostForm';
import type { Post } from '@/types/database';

export default function EditPostPage() {
  const params = useParams();
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const postId = params.id as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    try {
      const data = await communityService.getPostById(postId);
      setPost(data);
    } catch {
      setError('게시글을 찾을 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  if (loading || authLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-secondary rounded" />
          <div className="h-10 w-full bg-secondary rounded" />
          <div className="h-40 w-full bg-secondary rounded" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-3">{error ?? '게시글을 찾을 수 없습니다'}</h2>
        <Link href={ROUTES.COMMUNITY} className="btn-primary text-sm">목록으로 돌아가기</Link>
      </div>
    );
  }

  if (!profile || profile.id !== post.author_id) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-3">수정 권한이 없습니다</h2>
        <Link href={ROUTES.COMMUNITY_DETAIL(postId)} className="btn-primary text-sm">돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href={ROUTES.COMMUNITY_DETAIL(postId)}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">글 수정</h1>
      </div>

      <div className="card">
        <PostForm
          initialData={{ title: post.title, content: post.content, category: post.category }}
          postId={postId}
          onSubmitSuccess={(id) => router.push(ROUTES.COMMUNITY_DETAIL(id))}
        />
      </div>
    </div>
  );
}
