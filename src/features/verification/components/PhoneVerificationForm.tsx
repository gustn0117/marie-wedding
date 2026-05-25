'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestPhoneOtp, verifyPhoneOtp } from '@/features/verification/services/phoneVerificationService';

export default function PhoneVerificationForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const result = await requestPhoneOtp(phone);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setStage('verify');
    setInfo(`인증번호가 발송되었습니다. ${result.expiresInMinutes}분 이내에 입력해 주세요.`);
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const result = await verifyPhoneOtp(code);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    router.push('/mypage');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onRequest} className="space-y-3">
        <label className="block text-sm font-bold text-gray-900">휴대폰 번호</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
            required
            disabled={stage === 'verify'}
            className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={busy || stage === 'verify'}
            className="rounded border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-white disabled:opacity-50"
          >
            {stage === 'verify' ? '발송됨' : busy ? '발송 중…' : '인증번호 받기'}
          </button>
        </div>
        <p className="text-xs text-gray-500">대시(-) 없이 숫자만 입력해 주세요.</p>
      </form>

      {stage === 'verify' && (
        <form onSubmit={onVerify} className="space-y-3 pt-4 border-t border-gray-200">
          <label className="block text-sm font-bold text-gray-900">인증번호</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="6자리 숫자"
            required
            className="w-full border border-gray-300 px-3 py-2 text-base font-mono tracking-widest focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="btn-primary min-h-[44px] px-6 disabled:opacity-50"
          >
            {busy ? '확인 중…' : '인증 완료'}
          </button>
          <button
            type="button"
            onClick={() => { setStage('request'); setCode(''); setError(null); setInfo(null); }}
            className="text-xs text-gray-500 hover:underline"
          >
            번호 다시 입력
          </button>
        </form>
      )}

      {info && <p className="text-sm text-gray-700">{info}</p>}
      {error && <p className="text-sm text-state-urgent">{error}</p>}
    </div>
  );
}
