'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [left, setLeft] = useState(0);

  // 인증번호 3분 카운트다운
  useEffect(() => {
    if (!sentAt || step !== 'reset') { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, 180 - Math.floor((Date.now() - sentAt) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [sentAt, step]);

  const sendCode = async () => {
    if (!email.trim()) { setError('이메일을 입력해주세요.'); return; }
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/password-reset/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || '인증번호 발송에 실패했습니다.');
      setStep('reset');
      setSentAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증번호 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('인증번호 6자리를 입력해주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 최소 6자 이상이어야 합니다.'); return; }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || '비밀번호 변경에 실패했습니다.');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-surface rounded border border-border p-8 shadow-sm">
        <div className="flex flex-col items-center text-center mb-8 gap-2">
          <Link href={ROUTES.HOME} className="text-4xl font-bold tracking-tight text-ink" aria-label="Marié 홈">
            Marié
          </Link>
          <p className="text-sm text-text-secondary">비밀번호 재설정</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">{error}</div>
        )}

        {step === 'done' ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-ink">비밀번호가 변경되었습니다</h2>
            <p className="text-sm text-gray-500">새 비밀번호로 로그인해주세요.</p>
            <Link href={ROUTES.LOGIN} className="btn-primary w-full inline-flex">로그인하기</Link>
          </div>
        ) : step === 'request' ? (
          <>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              가입에 사용한 이메일을 입력하시면<br />인증번호를 보내드립니다.
            </p>
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">이메일</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                  placeholder="example@company.com"
                  className="input-field"
                />
              </div>
              <button type="button" onClick={sendCode} disabled={sending || !email} className="btn-primary w-full">
                {sending ? '발송 중…' : '인증번호 받기'}
              </button>
            </div>
            <p className="mt-6 text-center text-sm text-text-secondary">
              비밀번호가 기억나셨나요?{' '}
              <Link href={ROUTES.LOGIN} className="font-medium text-primary hover:text-primary-dark transition-colors">로그인</Link>
            </p>
          </>
        ) : (
          <form onSubmit={submitReset} className="space-y-5">
            <p className="text-sm text-gray-500 leading-relaxed">
              <span className="font-semibold text-ink">{email}</span> 으로 보낸<br />인증번호와 새 비밀번호를 입력해주세요.
            </p>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-text-primary mb-1.5">인증번호</label>
              <div className="relative">
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="인증번호 6자리"
                  className="input-field w-full pr-16"
                />
                {left > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold tabular-nums text-state-urgent">
                    {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11.5px] text-gray-400">{left > 0 ? '메일로 받은 6자리 인증번호' : '인증번호가 만료되었습니다.'}</span>
                <button type="button" onClick={sendCode} disabled={sending} className="text-[11.5px] font-semibold text-primary hover:text-primary-dark disabled:opacity-50">
                  {sending ? '발송 중…' : '재전송'}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">새 비밀번호</label>
              <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상 입력하세요" className="input-field" />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-text-primary mb-1.5">새 비밀번호 확인</label>
              <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="비밀번호를 다시 입력하세요" className="input-field" />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? '변경 중…' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
