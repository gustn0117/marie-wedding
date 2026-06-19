'use client';

import { useState } from 'react';
import { submitVerification } from '@/features/verification/services/verificationService';
import { withTimeout } from '@/shared/utils/withTimeout';

export default function VerificationForm() {
  const [businessNumber, setBusinessNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('사업자등록증 이미지를 첨부해 주세요.'); return; }
    setBusy(true); setError(null);
    try {
      const result = await withTimeout(submitVerification({ businessNumber, documentFile: file }), 20000);
      if (!result.ok) { setError(result.error); return; }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="platform-panel p-6 text-sm">
        <p className="font-bold text-gray-900">신청이 접수되었습니다.</p>
        <p className="mt-2 text-gray-600">관리자 검토 후 알림으로 결과를 알려드립니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-bold mb-2 text-gray-900">사업자번호</label>
        <input
          type="text"
          value={businessNumber}
          onChange={(e) => setBusinessNumber(e.target.value)}
          placeholder="예) 123-45-67890"
          required
          className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <p className="text-xs text-gray-500 mt-1">10자리 사업자번호. 입력한 정보와 사업자등록증 이미지가 일치해야 합니다.</p>
      </div>

      <div>
        <label className="block text-sm font-bold mb-2 text-gray-900">사업자등록증 사본</label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="w-full text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">JPG/PNG/PDF · 5MB 이하. 주민등록번호 등 민감 정보는 업로드 전 마스킹을 권장합니다.</p>
      </div>

      {error && <p className="text-sm text-state-urgent">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary min-h-[44px] px-6 disabled:opacity-50"
      >
        {busy ? '제출 중…' : '인증 신청'}
      </button>
    </form>
  );
}
