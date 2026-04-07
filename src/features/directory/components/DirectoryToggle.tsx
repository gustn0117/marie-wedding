'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';

interface DirectoryToggleProps {
  profileId: string;
  initialListed: boolean;
  missingInfo: boolean;
}

export default function DirectoryToggle({ profileId, initialListed, missingInfo }: DirectoryToggleProps) {
  const [listed, setListed] = useState(initialListed);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const next = !listed;
      await directoryService.toggleDirectoryListing(profileId, next);
      setListed(next);
      // 쿠키 갱신을 위해 새로고침
      document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했습니다. 다시 시도해주세요.');
      setSubmitting(false);
    }
  };

  if (listed) {
    return (
      <>
      {error && <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
      <div className="space-y-3">
        <Link href={ROUTES.DIRECTORY_DETAIL(profileId)} className="block text-center px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          내 디렉토리 페이지 보기
        </Link>
        <button
          onClick={handleToggle}
          disabled={submitting}
          className="w-full px-5 py-2.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          {submitting ? '처리 중...' : '디렉토리에서 내리기'}
        </button>
      </div>
      </>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={submitting || missingInfo}
      className="w-full btn-primary text-sm py-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {submitting ? '등록 중...' : '디렉토리에 등록하기'}
    </button>
  );
}
