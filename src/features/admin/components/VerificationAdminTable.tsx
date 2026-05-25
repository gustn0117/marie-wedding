'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  decideVerification,
  getDocumentSignedUrl,
} from '@/features/admin/services/adminVerificationService';
import { getBusinessTypeLabel } from '@/shared/utils/format';
import type { VerificationRow } from '@/features/verification/types';

export default function VerificationAdminTable({ rows }: { rows: VerificationRow[] }) {
  const [items, setItems] = useState(rows);
  const [pending, startTransition] = useTransition();
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    rows.forEach(async (r) => {
      if (r.verification_document) {
        const url = await getDocumentSignedUrl(r.verification_document);
        if (url) setDocUrls((p) => ({ ...p, [r.id]: url }));
      }
    });
  }, [rows]);

  function handle(id: string, decision: 'verified' | 'rejected') {
    let reason: string | undefined;
    if (decision === 'rejected') {
      const r = window.prompt('거절 사유를 입력하세요.');
      if (!r?.trim()) return;
      reason = r;
    }
    startTransition(async () => {
      const result = await decideVerification(id, decision, reason);
      if (result.ok) setItems((prev) => prev.filter((x) => x.id !== id));
      else window.alert(result.error);
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-600">검토 대기 중인 신청이 없습니다.</p>;
  }

  return (
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
  );
}
