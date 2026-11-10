'use client';

import { useState } from 'react';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import { toast } from '@/shared/components/Toast';
import { formatRelativeTime } from '@/shared/utils/format';
import { unblockUser, useBlocks } from '../blockStore';

/** 마이페이지 > 차단한 사용자 — 목록과 차단 해제 */
export default function BlockedUsersList() {
  const { items, ready, error, reload } = useBlocks();
  const [busyId, setBusyId] = useState<string | null>(null);

  const unblock = async (profileId: string) => {
    setBusyId(profileId);
    try {
      await unblockUser(profileId);
      toast('차단을 해제했어요.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '처리하지 못했어요.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[860px] space-y-4">
      <section className="saramin-section p-5">
        <h1 className="text-2xl font-bold text-gray-900">차단한 사용자</h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          차단한 사용자의 글과 댓글은 보이지 않고, 서로 쪽지를 주고받을 수 없어요. 해제하면 바로 다시 보여요.
        </p>
      </section>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        {!ready ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">불러오는 중…</p>
        ) : error ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-500">차단 목록을 불러오지 못했어요.</p>
            <button type="button" onClick={() => void reload()} className="mt-2 text-sm font-bold text-primary hover:underline">
              다시 시도
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">차단한 사용자가 없어요.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.profileId} className="flex items-center gap-3 px-5 py-4">
                <ProfileAvatar profileImage={item.profileImage} name={item.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-400">{formatRelativeTime(item.blockedAt)} 차단</p>
                </div>
                <button
                  type="button"
                  onClick={() => unblock(item.profileId)}
                  disabled={busyId === item.profileId}
                  className="shrink-0 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {busyId === item.profileId ? '해제 중…' : '차단 해제'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
