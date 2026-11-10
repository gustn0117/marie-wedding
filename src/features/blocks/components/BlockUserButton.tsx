'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast, toastConfirm } from '@/shared/components/Toast';
import { loginHref } from '@/shared/utils/loginRedirect';
import { blockUser, unblockUser, useBlocks } from '../blockStore';

interface Props {
  profileId: string;
  /** 확인 창에 보일 이름 */
  name: string;
  profileImage?: string | null;
  /** 'button' = 신고 버튼과 같은 테두리 버튼, 'text' = 댓글 줄 같은 곳의 작은 글자 버튼 */
  variant?: 'button' | 'text';
}

/**
 * 이용자 차단/해제 버튼. 내 글·내 프로필에는 나오지 않는다.
 * 차단하면 그 사람의 글·댓글이 바로 안 보이고, 서로 쪽지를 주고받을 수 없다.
 */
export default function BlockUserButton({ profileId, name, profileImage, variant = 'button' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { ids, myProfileId } = useBlocks();
  const [busy, setBusy] = useState(false);

  if (myProfileId && myProfileId === profileId) return null;
  const blocked = ids.has(profileId);
  const displayName = name || '이 사용자';

  const onClick = async () => {
    if (!myProfileId) {
      router.push(loginHref(pathname));
      return;
    }
    const ok = await toastConfirm(
      blocked
        ? `${displayName}님 차단을 해제할까요?`
        : `${displayName}님을 차단할까요?\n\n차단하면 이 사용자의 글과 댓글이 보이지 않고, 서로 쪽지를 주고받을 수 없어요. 마이페이지 > 차단한 사용자에서 언제든 해제할 수 있어요.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      if (blocked) {
        await unblockUser(profileId);
        toast('차단을 해제했어요.', 'success');
      } else {
        await blockUser({ profileId, name: displayName, profileImage });
        toast(`${displayName}님을 차단했어요.`, 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '처리하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const label = blocked ? '차단 해제' : '차단';

  if (variant === 'text') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="text-xs text-gray-400 transition-colors hover:text-state-urgent disabled:opacity-50"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-500 transition-colors hover:border-gray-400 hover:text-ink disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      {label}
    </button>
  );
}
