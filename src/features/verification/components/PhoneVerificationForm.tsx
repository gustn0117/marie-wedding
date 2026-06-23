'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestPhoneOtp, verifyPhoneOtp } from '@/features/verification/services/phoneVerificationService';
import { validatePhone } from '@/shared/utils/validation';

/**
 * 휴대폰 SMS OTP 본인확인 폼.
 *
 * 단계: request (번호 입력) → verify (6자리 인증번호 입력) → success (mypage 이동)
 * - 번호는 표시용으로 자동 하이픈(010-XXXX-XXXX), 서버에는 숫자만 전송
 * - 재발송 60초 cooldown
 * - 발송 후 5분 카운트다운 표시
 */
export default function PhoneVerificationForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'request' | 'verify' | 'success'>('request');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0); // 초

  // 60초 재발송 cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // 인증번호 만료 카운트다운
  useEffect(() => {
    if (stage !== 'verify' || expiresIn <= 0) return;
    const t = setTimeout(() => setExpiresIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, expiresIn]);

  const phoneDigits = phone.replace(/[^0-9]/g, '');

  function formatPhone(raw: string): string {
    const d = raw.replace(/[^0-9]/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    const check = validatePhone(phone);
    if (!check.valid) {
      setError(check.reason ?? '번호를 다시 확인해 주세요.');
      return;
    }
    setBusy(true); setError(null); setInfo(null);
    const result = await requestPhoneOtp(phoneDigits);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setStage('verify');
    setInfo(`${formatPhone(phone)} 로 인증번호를 보냈어요.`);
    setExpiresIn(result.expiresInMinutes * 60);
    setResendCooldown(60);
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const result = await verifyPhoneOtp(code);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setStage('success');
    setInfo('휴대폰 인증이 완료되었습니다.');
    setTimeout(() => {
      router.push('/mypage');
      router.refresh();
    }, 900);
  }

  async function onResend() {
    if (resendCooldown > 0) return;
    setBusy(true); setError(null);
    const result = await requestPhoneOtp(phoneDigits);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setInfo('인증번호를 다시 보냈어요.');
    setExpiresIn(result.expiresInMinutes * 60);
    setResendCooldown(60);
    setCode('');
  }

  if (stage === 'success') {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary-50/50 px-5 py-6 text-center">
        <div className="mx-auto mb-3 inline-flex w-12 h-12 items-center justify-center rounded-full bg-primary text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-primary">인증 완료</h3>
        <p className="mt-1 text-sm text-gray-600">마이페이지로 이동합니다…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1단계: 번호 입력 */}
      <form onSubmit={onRequest} className="space-y-2">
        <label className="block text-sm font-bold text-gray-900">휴대폰 번호</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            required
            disabled={stage === 'verify' || busy}
            inputMode="numeric"
            className="flex-1 rounded border border-gray-300 px-3 py-2.5 text-base tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={busy || stage === 'verify' || phoneDigits.length < 10}
            className="rounded border-2 border-primary px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy && stage === 'request' ? '발송 중…' : '인증번호 받기'}
          </button>
        </div>
        <p className="text-xs text-gray-500">본인 명의의 휴대폰 번호로 6자리 인증번호를 보내드려요.</p>
      </form>

      {/* 2단계: 인증번호 입력 */}
      {stage === 'verify' && (
        <form onSubmit={onVerify} className="space-y-3 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-bold text-gray-900">인증번호</label>
            {expiresIn > 0 && (
              <span className="text-xs font-bold tabular-nums text-state-urgent">
                {Math.floor(expiresIn / 60)}:{(expiresIn % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="6자리"
            required
            autoFocus
            className="w-full rounded border border-gray-300 px-4 py-3 text-lg font-mono tracking-[0.4em] text-center focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onResend}
              disabled={resendCooldown > 0 || busy}
              className="text-xs font-bold text-gray-500 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `재발송 (${resendCooldown}초 후)` : '인증번호 재발송'}
            </button>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="btn-primary px-6"
            >
              {busy ? '확인 중…' : '인증 완료'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setStage('request');
              setCode('');
              setError(null);
              setInfo(null);
              setExpiresIn(0);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
          >
            ← 번호 다시 입력
          </button>
        </form>
      )}

      {info && (
        <p className="rounded bg-secondary-50 border border-secondary-100 px-3 py-2 text-sm text-gray-700">
          {info}
        </p>
      )}
      {error && (
        <p className="rounded bg-state-urgent-bg border border-state-urgent/30 px-3 py-2 text-sm text-state-urgent">
          {error}
        </p>
      )}
    </div>
  );
}
