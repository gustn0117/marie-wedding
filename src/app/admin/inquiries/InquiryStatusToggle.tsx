'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';

export default function InquiryStatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const resolved = currentStatus === 'resolved';

  useEffect(() => {
    if (!busy) setCurrentStatus(status);
  }, [busy, status]);

  const toggle = async () => {
    if (busy) return;
    const previous = currentStatus;
    const next = resolved ? 'open' : 'resolved';
    setCurrentStatus(next);
    setBusy(true);
    try {
      const response = await apiFetch('/api/admin/inquiries/status', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      }, 12_000);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || '상태를 변경하지 못했습니다.');
      }
      router.refresh();
    } catch (error) {
      setCurrentStatus(previous);
      toast(error instanceof Error ? error.message : '상태를 변경하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center px-2.5 h-7 rounded-full text-[11px] font-bold border transition-colors disabled:opacity-50 ${
        resolved
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
      }`}
      title="클릭하여 상태 전환"
    >
      {resolved ? '처리완료' : '대기 중'}
    </button>
  );
}
