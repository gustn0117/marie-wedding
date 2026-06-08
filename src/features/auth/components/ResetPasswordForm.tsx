'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants';
import Logo from '@/shared/components/Logo';

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Supabase는 recovery 링크 클릭 시 자동으로 PASSWORD_RECOVERY 이벤트를 트리거하고 세션을 임시로 만든다.
  // 그 세션이 있어야 updateUser({ password })가 동작.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: apiError } = await supabase.auth.updateUser({ password });
      if (apiError) {
        setError(apiError.message);
        return;
      }
      setDone(true);
      setTimeout(() => router.push(ROUTES.LOGIN), 1200);
    } catch {
      setError('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-surface rounded border border-border p-8 shadow-sm">
        <div className="flex flex-col items-center text-center mb-8 gap-2">
          <Link href={ROUTES.HOME} aria-label="Marié 홈">
            <Logo variant="full" size="lg" />
          </Link>
          <p className="text-sm text-text-secondary">새 비밀번호 설정</p>
        </div>

        {authed === false ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              재설정 링크가 유효하지 않거나 만료되었습니다.<br />
              새 링크를 다시 요청해 주세요.
            </p>
            <Link href={ROUTES.FORGOT_PASSWORD} className="btn-primary inline-flex">
              비밀번호 찾기로 이동
            </Link>
          </div>
        ) : done ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-ink font-semibold">비밀번호가 변경되었습니다.</p>
            <p className="text-xs text-gray-500">로그인 페이지로 이동합니다...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-3 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">
                  새 비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상"
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-text-primary mb-1.5">
                  비밀번호 확인
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-field"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || authed === null}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {submitting ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
