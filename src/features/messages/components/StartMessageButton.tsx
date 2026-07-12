'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { messageService } from '@/features/messages/services/messageService';
import { withTimeout } from '@/shared/utils/withTimeout';
import { toast } from '@/shared/components/Toast';

interface Props {
  targetProfileId: string;
  variant?: 'primary' | 'secondary';
}

export default function StartMessageButton({ targetProfileId, variant = 'primary' }: Props) {
  const { profile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (profile?.id === targetProfileId) return null;

  async function onClick() {
    if (!profile) { toast('로그인이 필요합니다.', 'error'); return; }
    setBusy(true);
    try {
      const conv = await withTimeout(messageService.startConversation(targetProfileId), 10000, '대화 시작 지연');
      router.push(`/mypage/messages/${conv.id}`);
    } catch {
      toast('대화 시작에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const baseClass = variant === 'primary'
    ? 'btn-primary px-4'
    : 'rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition-colors';

  return (
    <button type="button" onClick={onClick} disabled={busy} className={`${baseClass} disabled:opacity-50`}>
      {busy ? '시작 중…' : '쪽지 보내기'}
    </button>
  );
}
