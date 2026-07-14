'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants';
import { withTimeout } from '@/shared/utils/withTimeout';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}${ROUTES.RESET_PASSWORD}`
        : undefined;
      const { error: apiError } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, { redirectTo }),
        12000,
        '메일 전송 요청 지연',
      );
      // 보안상 이메일 존재 여부를 노출하지 않음 — 항상 성공처럼 표시
      if (apiError && !apiError.message.toLowerCase().includes('email')) {
        setError(apiError.message);
      } else {
        setSent(true);
      }
    } catch {
      // 네트워크 등 실제 실패만 노출
      setError('재설정 메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
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

        {sent ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-ink">메일을 확인해 주세요</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              가입된 이메일이라면 <span className="font-semibold text-ink">{email}</span> 으로<br />
              비밀번호 재설정 링크를 보냈습니다.<br />
              메일이 도착하지 않으면 스팸함도 확인해 주세요.
            </p>
            <Link href={ROUTES.LOGIN} className="btn-primary w-full inline-flex">로그인으로 돌아가기</Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              가입에 사용한 이메일을 입력하시면<br />재설정 링크를 보내드립니다.
            </p>

            {error && (
              <div className="mb-6 p-3 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
                  이메일
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  className="input-field"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !email}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {submitting ? '발송 중...' : '재설정 링크 받기'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              비밀번호가 기억나셨나요?{' '}
              <Link href={ROUTES.LOGIN} className="font-medium text-primary hover:text-primary-dark transition-colors">
                로그인
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
