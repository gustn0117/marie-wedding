'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { bookmarkService } from '@/features/bookmarks/services/bookmark-service';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { withTimeout } from '@/shared/utils/withTimeout';
import type { BookmarkTargetType } from '@/types/database';

interface BookmarkButtonProps {
  targetType: BookmarkTargetType;
  targetId: string;
  label?: string;
}

export default function BookmarkButton({ targetType, targetId, label = '저장' }: BookmarkButtonProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    bookmarkService
      .getBookmark(profile.id, targetType, targetId)
      .then((bookmark) => setSaved(!!bookmark))
      .catch(() => {});
  }, [profile, targetId, targetType]);

  const handleClick = async () => {
    if (!profile) {
      if (confirm('저장하려면 로그인이 필요합니다. 로그인 페이지로 이동할까요?')) {
        router.push(ROUTES.LOGIN);
      }
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const result = await withTimeout(
        bookmarkService.toggleBookmark(profile.id, targetType, targetId),
        8000,
        '저장 처리 지연',
      );
      setSaved(result.saved);
    } catch {
      alert('저장 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded border px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
        saved
          ? 'border-primary bg-primary-50 text-primary'
          : 'border-gray-300 bg-white text-gray-600 hover:border-primary hover:text-primary'
      }`}
    >
      <svg className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
      </svg>
      {saved ? '저장됨' : label}
    </button>
  );
}
