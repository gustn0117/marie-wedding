'use client';

import { useEffect, useRef, useState } from 'react';
import { loginHref } from '@/shared/utils/loginRedirect';
import { useRouter, usePathname } from 'next/navigation';
import { bookmarkService } from '@/features/bookmarks/services/bookmark-service';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { withTimeout } from '@/shared/utils/withTimeout';
import { toast } from '@/shared/components/Toast';
import { friendlyError } from '@/shared/utils/errorMessages';
import type { BookmarkTargetType } from '@/types/database';

interface BookmarkButtonProps {
  targetType: BookmarkTargetType;
  targetId: string;
  label?: string;
  /** SSR 에서 미리 조회한 saved 상태 — '저장' → '저장됨' flip flash 방지 */
  initialSaved?: boolean;
}

export default function BookmarkButton({ targetType, targetId, label = '저장', initialSaved = false }: BookmarkButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  // 사용자가 토글하면 true — 이후 mount 조회 응답(토글 전 시작분)이 늦게 도착해도 덮어쓰지 않게 한다.
  const interactedRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    // 대상/프로필 변경(재실행)마다 초기화. cancelled 는 언마운트/재실행 취소,
    // interactedRef 는 '토글 이후 stale 조회 무시' 를 담당(둘 다 필요).
    let cancelled = false;
    interactedRef.current = false;
    bookmarkService
      .getBookmark(profile.id, targetType, targetId)
      .then((bookmark) => { if (!cancelled && !interactedRef.current) setSaved(!!bookmark); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile, targetId, targetType]);

  const handleClick = async () => {
    if (!profile) {
      if (confirm('저장하려면 로그인이 필요합니다. 로그인 페이지로 이동할까요?')) {
        router.push(loginHref(pathname));
      }
      return;
    }
    if (loading) return;
    interactedRef.current = true; // 이 시점 이후엔 mount 조회 결과보다 토글 결과가 우선.
    setLoading(true);
    try {
      const result = await withTimeout(
        bookmarkService.toggleBookmark(profile.id, targetType, targetId),
        8000,
        '저장 처리 지연',
      );
      setSaved(result.saved);
    } catch (err) {
      toast(friendlyError(err, '저장 처리에 실패했습니다.'), 'error');
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
