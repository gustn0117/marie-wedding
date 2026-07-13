'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InquiryStatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const resolved = status === 'resolved';

  const toggle = async () => {
    setBusy(true);
    try {
      await fetch('/api/admin/inquiries/status', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: resolved ? 'open' : 'resolved' }),
      });
      router.refresh();
    } catch {
      /* noop */
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
