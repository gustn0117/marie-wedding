'use client';

import { useState } from 'react';
import { submitVerification } from '@/features/verification/services/verificationService';
import { withTimeout } from '@/shared/utils/withTimeout';
import { compressImage } from '@/shared/utils/image';

// 사업자번호 000-00-00000 자동 하이픈
function formatBizNo(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function VerificationForm() {
  const [businessNumber, setBusinessNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const bizDigits = businessNumber.replace(/[^0-9]/g, '');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (bizDigits.length !== 10) { setError('사업자번호 10자리를 정확히 입력해 주세요.'); return; }
    if (!file) { setError('사업자등록증 이미지를 첨부해 주세요.'); return; }
    setBusy(true); setError(null);
    try {
      // 큰 이미지는 업로드 전에 압축 → 대용량도 즉시 처리 (PDF 는 원본 유지)
      const doc = file.type.startsWith('image/')
        ? await compressImage(file, { maxDimension: 2200, quality: 0.8 })
        : file;
      const result = await withTimeout(submitVerification({ businessNumber, documentFile: doc }), 65000);
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
      <div className="text-center py-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-bold text-gray-900">신청이 접수되었습니다</p>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          관리자 검토 후 알림으로 결과를 알려드립니다.<br />
          승인되면 프로필과 카드에 <span className="font-semibold text-primary">인증 배지</span>가 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 안내 */}
      <div className="rounded-lg bg-secondary-50 border border-gray-100 p-4">
        <p className="text-sm font-bold text-gray-900 mb-2">인증하면 이렇게 달라져요</p>
        <ul className="space-y-1.5 text-[13px] text-gray-600">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            프로필·업체 카드·공고에 <span className="font-semibold text-gray-800">인증 배지</span> 노출
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            지원자·구직자에게 <span className="font-semibold text-gray-800">신뢰도</span> 상승
          </li>
        </ul>
      </div>

      {/* 사업자번호 */}
      <div>
        <label htmlFor="bizno" className="block text-sm font-bold mb-2 text-gray-900">
          사업자등록번호 <span className="text-state-urgent">*</span>
        </label>
        <input
          id="bizno"
          type="text"
          inputMode="numeric"
          value={businessNumber}
          onChange={(e) => { setBusinessNumber(formatBizNo(e.target.value)); if (error) setError(null); }}
          placeholder="000-00-00000"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm tracking-wide focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <p className="text-xs text-gray-500 mt-1.5">숫자 10자리. 등록증 이미지의 번호와 일치해야 합니다.</p>
      </div>

      {/* 파일 첨부 (드롭존) */}
      <div>
        <label className="block text-sm font-bold mb-2 text-gray-900">
          사업자등록증 사본 <span className="text-state-urgent">*</span>
        </label>
        <label
          htmlFor="bizdoc"
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${
            file ? 'border-primary bg-primary-50/40' : 'border-gray-300 hover:border-primary hover:bg-secondary-50'
          }`}
        >
          {file ? (
            <>
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              <span className="text-sm font-semibold text-gray-900 break-all text-center">{file.name}</span>
              <span className="text-xs text-gray-500">{formatSize(file.size)} · 다른 파일로 변경하려면 클릭</span>
            </>
          ) : (
            <>
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              <span className="text-sm font-semibold text-gray-700">이미지 또는 PDF 첨부</span>
              <span className="text-xs text-gray-500">JPG · PNG · PDF / 5MB 이하</span>
            </>
          )}
          <input
            id="bizdoc"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (error) setError(null); }}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-500 mt-1.5">주민등록번호 등 민감 정보는 업로드 전 가려주세요(마스킹 권장).</p>
      </div>

      {error && (
        <div className="rounded-lg bg-state-urgent-bg border border-red-200 px-3.5 py-2.5 text-sm text-state-urgent">{error}</div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full min-h-[46px] disabled:opacity-50"
      >
        {busy ? '제출 중…' : '인증 신청하기'}
      </button>
      <p className="text-center text-xs text-gray-400">검토는 영업일 기준 1~3일 소요됩니다.</p>
    </form>
  );
}
