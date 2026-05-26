'use client';

import { useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { reportService } from '@/features/reports/services/report-service';
import type { ReportTargetType } from '@/types/database';

const REASONS = [
  '허위 정보',
  '스팸/광고',
  '부적절한 내용',
  '거래/연락 문제',
  '기타',
] as const;

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
}

export default function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await reportService.createReport({
        reporterId: profile?.id ?? null,
        targetType,
        targetId,
        reason,
        details,
      });
      setOpen(false);
      setDetails('');
      alert('신고가 접수되었습니다.');
    } catch {
      alert('신고 접수에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-500 hover:border-red-200 hover:bg-state-urgent-bg hover:text-state-urgent transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM3.4 19.5h17.2c1.54 0 2.5-1.667 1.73-3L13.73 2.25c-.77-1.333-2.69-1.333-3.46 0L1.67 16.5c-.77 1.333.192 3 1.73 3z" />
        </svg>
        신고
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-bold text-gray-900">신고하기</h2>
              <p className="mt-1 text-xs text-gray-500">검토에 필요한 최소 정보만 입력해주세요.</p>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-800">사유</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-800">상세 내용</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  className="input-field resize-none"
                  placeholder="상황을 간단히 적어주세요."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">취소</button>
              <button type="button" onClick={submit} disabled={submitting} className="btn-primary text-sm">
                {submitting ? '접수 중...' : '접수하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
