'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { communityService } from '@/features/community/services/community-service';

interface PostDetailActionsProps {
  postId: string;
  authorId: string;
}

export default function PostDetailActions({ postId, authorId }: PostDetailActionsProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const isAuthor = profile && profile.id === authorId;
  if (!isAuthor) return null;

  const handleDelete = async () => {
    if (!confirm('게시글을 삭제하시겠습니까?')) return;
    setDeleting(true);
    try {
      await communityService.deletePost(postId);
      router.push(ROUTES.COMMUNITY);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={ROUTES.COMMUNITY_EDIT(postId)}
        className="text-xs text-gray-400 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50"
      >
        수정
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
      >
        {deleting ? '삭제 중...' : '삭제'}
      </button>
    </div>
  );
}
