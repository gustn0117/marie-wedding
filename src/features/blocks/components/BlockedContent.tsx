'use client';

import { useState } from 'react';
import { toast } from '@/shared/components/Toast';
import { unblockUser, useBlocks } from '../blockStore';

/**
 * 차단한 사람이 쓴 내용이면 본문 대신 안내를 보인다(해제하면 바로 다시 보인다).
 * 서버가 그린 본문을 children 으로 받아 그대로 감싼다.
 */
export default function BlockedContent({
  authorId,
  label = '글',
  children,
}: {
  authorId: string | null | undefined;
  label?: string;
  children: React.ReactNode;
}) {
  const { ids } = useBlocks();
  const [busy, setBusy] = useState(false);

  if (!authorId || !ids.has(authorId)) return <>{children}</>;

  const unblock = async () => {
    setBusy(true);
    try {
      await unblockUser(authorId);
      toast('차단을 해제했어요.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '처리하지 못했어요.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-gray-700">차단한 사용자의 {label}입니다.</p>
      <button
        type="button"
        onClick={unblock}
        disabled={busy}
        className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
      >
        차단 해제하고 보기
      </button>
    </div>
  );
}
