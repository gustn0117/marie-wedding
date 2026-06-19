'use client';

import { useCallback, useState } from 'react';
import type { Job, JobStatus } from '@/types/database';
import { jobService } from '@/features/jobs/services/job-service';
import { withTimeout } from '@/shared/utils/withTimeout';
import { toast } from '@/shared/components/Toast';
import { useOutsideClick } from '@/shared/hooks/useOutsideClick';

const ACTIONS: { value: 'open' | 'closed' | 'filled' | 'hidden'; label: string; description: string }[] = [
  { value: 'open', label: '다시 모집', description: '공고를 모집중으로 되돌립니다' },
  { value: 'filled', label: '채용 완료', description: '더 이상 지원을 받지 않습니다' },
  { value: 'closed', label: '마감 처리', description: '마감일 무관 즉시 마감' },
  { value: 'hidden', label: '숨김', description: '다른 사용자에게 공개하지 않습니다' },
];

export default function JobStatusMenu({ job, onChange }: { job: Job; onChange?: (next: Job) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // 이전 구현: <button className="fixed inset-0 z-10"> 오버레이로 외부 클릭 처리.
  // 문제: 같은 리스트의 다른 행 트리거가 오버레이에 가려져 1차 클릭이 흡수됨 →
  // "두 번 클릭해야 한다" 또는 "다른 행 상태 메뉴가 안 열린다" 버그.
  // 수정: viewport overlay 제거 + useOutsideClick으로 ref 영역 외 클릭만 capture phase로 감지.
  const close = useCallback(() => setOpen(false), []);
  const wrapRef = useOutsideClick<HTMLDivElement>(open, close);

  async function apply(status: 'open' | 'closed' | 'filled' | 'hidden') {
    if (status === job.status) { setOpen(false); return; }
    setBusy(true);
    try {
      const updated = await withTimeout(jobService.updateStatus(job.id, status), 8000);
      toast('상태를 변경했습니다.', 'success');
      onChange?.(updated);
      setOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : '상태 변경 실패', 'error');
    } finally {
      setBusy(false);
    }
  }

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  }

  return (
    <div ref={wrapRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="text-xs font-bold text-gray-600 hover:text-primary border border-gray-300 px-2 py-1 rounded disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        상태 ▾
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          {ACTIONS.filter((a) => a.value !== job.status).map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => apply(a.value)}
              disabled={busy}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-bold text-gray-900">{a.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const JOB_STATUS_BADGE: Record<JobStatus, string> = {
  open: '모집중',
  urgent: '마감임박',
  closed: '마감',
  filled: '채용완료',
  hidden: '숨김',
};
