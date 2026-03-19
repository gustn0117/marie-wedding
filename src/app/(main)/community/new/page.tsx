'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/features/auth/hooks/useAuth';
import PostForm from '@/features/community/components/PostForm';
import Link from 'next/link';

export default function NewPostPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-secondary rounded" />
          <div className="h-10 w-full bg-secondary rounded" />
          <div className="h-10 w-full bg-secondary rounded" />
          <div className="h-40 w-full bg-secondary rounded" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="font-serif text-xl font-semibold text-text-primary mb-3">
          로그인이 필요합니다
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          게시글을 작성하려면 먼저 로그인해주세요.
        </p>
        <Link href={ROUTES.LOGIN} className="btn-primary text-sm">
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          돌아가기
        </button>
        <h1 className="font-serif text-2xl font-bold text-text-primary">
          새 글 작성
        </h1>
      </div>

      {/* Form */}
      <div className="card">
        <PostForm />
      </div>
    </div>
  );
}
