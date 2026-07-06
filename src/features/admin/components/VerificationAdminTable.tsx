'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  decideVerification,
  getDocumentSignedUrl,
} from '@/features/admin/services/adminVerificationService';
import { getBusinessTypeLabel } from '@/shared/utils/format';
import type { VerificationRow } from '@/features/verification/types';
import { toast } from '@/shared/components/Toast';
import { withTimeout } from '@/shared/utils/withTimeout';

interface RejectModal {
  id: string;
  companyName: string;
  reason: string;
}

export default function VerificationAdminTable({ rows }: { rows: VerificationRow[] }) {
  const [items, setItems] = useState(rows);
  const [pending, startTransition] = useTransition();
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [rejectModal, setRejectModal] = useState<RejectModal | null>(null);

  useEffect(() => {
    rows.forEach(async (r) => {
      if (r.verification_document) {
        const url = await getDocumentSignedUrl(r.verification_document);
        if (url) setDocUrls((p) => ({ ...p, [r.id]: url }));
      }
    });
  }, [rows]);

  function handle(id: string, decision: 'verified' | 'rejected') {
    if (decision === 'rejected') {
      const row = items.find((x) => x.id === id);
      setRejectModal({ id, companyName: row?.company_name || row?.contact_name || '업체', reason: '' });
      return;
    }
    startTransition(async () => {
      try {
        const result = await withTimeout(
          decideVerification(id, 'verified'),
          12000,
          '인증 처리 지연',
        );
        if (result.ok) {
          setItems((prev) => prev.filter((x) => x.id !== id));
          toast('인증을 승인했습니다.', 'success');
        } else {
          toast(result.error, 'error');
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : '인증 처리 지연', 'error');
      }
    });
  }

  function confirmReject() {
    if (!rejectModal) return;
    const { id, reason } = rejectModal;
    if (!reason.trim()) {
      toast('거절 사유를 입력해 주세요.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        const result = await withTimeout(
          decideVerification(id, 'rejected', reason.trim()),
          12000,
          '인증 처리 지연',
        );
        if (result.ok) {
          setItems((prev) => prev.filter((x) => x.id !== id));
          toast('인증을 거절했습니다.', 'success');
          setRejectModal(null);
        } else {
          toast(result.error, 'error');
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : '인증 처리 지연', 'error');
      }
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-600">검토 대기 중인 신청이 없습니다.</p>;
  }

  return (
    <>
    <div className="border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr className="text-xs">
            <th className="px-3 py-2 border-b border-gray-200 font-bold">업체명</th>
            <th className="px-3 py-2 border-b border-gray-200 font-bold">담당자</th>
            <th className="px-3 py-2 border-b border-gray-200 font-bold">업종</th>
            <th className="px-3 py-2 border-b border-gray-200 font-bold">사업자번호</th>
            <th className="px-3 py-2 border-b border-gray-200 font-bold">신청일</th>
            <th className="px-3 py-2 border-b border-gray-200 font-bold">서류</th>
            <th className="px-3 py-2 border-b border-gray-200 font-bold">처리</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="px-3 py-2 font-medium">{r.company_name || '-'}</td>
              <td className="px-3 py-2">{r.contact_name}</td>
              <td className="px-3 py-2 text-gray-600">
                {r.business_type
                  ? r.business_type.split(',').map((bt) => getBusinessTypeLabel(bt.trim())).join(', ')
                  : '-'}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.business_number || '-'}</td>
              <td className="px-3 py-2 text-gray-600">
                {r.verification_submitted_at
                  ? new Date(r.verification_submitted_at).toLocaleString('ko-KR')
                  : '-'}
              </td>
              <td className="px-3 py-2">
                {docUrls[r.id] ? (
                  <a
                    href={docUrls[r.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    보기
                  </a>
                ) : (
                  <span className="text-gray-400">로딩…</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <button
                  onClick={() => handle(r.id, 'verified')}
                  disabled={pending}
                  className="mr-1 inline-flex items-center px-2.5 py-1 bg-primary text-white text-xs font-bold disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  onClick={() => handle(r.id, 'rejected')}
                  disabled={pending}
                  className="inline-flex items-center px-2.5 py-1 border border-gray-300 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  거절
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {rejectModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">인증 거절</p>
          <h2 className="text-base font-bold text-gray-900 mb-3">{rejectModal.companyName}</h2>
          <p className="text-xs text-gray-500 mb-3">거절 사유를 입력해 주세요. 사용자에게 알림으로 전송됩니다.</p>
          <textarea
            value={rejectModal.reason}
            onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
            rows={4}
            placeholder="예) 사업자등록증 정보와 입력한 사업자번호가 일치하지 않습니다."
            className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none mb-4"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectModal(null)}
              disabled={pending}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-primary"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmReject}
              disabled={pending || !rejectModal.reason.trim()}
              className="rounded border border-state-urgent bg-state-urgent px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              거절 처리
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
