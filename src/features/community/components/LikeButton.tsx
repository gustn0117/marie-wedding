'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { communityService } from '../services/community-service';
import { ROUTES } from '@/shared/constants';

interface LikeButtonProps {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  canLike: boolean;
  viewerProfileId: string | null;
}

export default function LikeButton({ postId, initialLiked, initialCount, canLike, viewerProfileId }: LikeButtonProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!canLike || !viewerProfileId) {
      if (confirm('좋아요를 누르려면 로그인이 필요합니다. 로그인 페이지로 이동할까요?')) {
        router.push(ROUTES.LOGIN);
      }
      return;
    }
    if (loading) return;
    setLoading(true);
    // optimistic update
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    try {
      const result = await communityService.toggleLike(postId, viewerProfileId);
      setLiked(result.liked);
      setCount(result.likeCount);
    } catch {
      // revert
      setLiked(liked);
      setCount(count);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-6 py-3 border-2 transition-all ${
        liked
          ? 'bg-red-50 border-red-300 text-red-500'
          : 'bg-white border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500'
      } disabled:opacity-60`}
    >
      <svg
        className="w-5 h-5 transition-transform"
        fill={liked ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
      <span className="text-sm font-bold">{liked ? '좋아요 취소' : '좋아요'}</span>
      <span className="text-sm font-bold">{count}</span>
    </button>
  );
}
