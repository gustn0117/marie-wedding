'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { createClient } from '@/lib/supabase/client';
import { withTimeout } from '@/shared/utils/withTimeout';

export default function ChangePasswordPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('현재 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('새 비밀번호가 현재 비밀번호와 같습니다.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();

      // 1) 현재 비밀번호 확인 — 재인증(signInWithPassword)으로 본인 검증.
      //    틀린 현재 비밀번호로는 변경되지 않게 한다.
      const { data: userData } = await withTimeout(supabase.auth.getUser(), 12000, '계정 확인 지연');
      const email = userData.user?.email;
      if (!email) {
        setError('이메일로 가입한 계정에서만 비밀번호를 변경할 수 있습니다.');
        setSubmitting(false);
        return;
      }
      const { error: reauthError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password: currentPassword }),
        12000,
        '현재 비밀번호 확인 지연',
      );
      if (reauthError) {
        setError('현재 비밀번호가 일치하지 않습니다.');
        setSubmitting(false);
        return;
      }

      // 2) 새 비밀번호로 변경
      const { error: updateError } = await withTimeout(
        supabase.auth.updateUser({ password: newPassword }),
        12000,
        '비밀번호 변경 지연',
      );
      if (updateError) throw updateError;
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-secondary rounded" />
        <div className="card p-8 space-y-4">
          <div className="h-10 rounded bg-secondary" />
          <div className="h-10 rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h2 className="text-xl font-bold text-text-primary mb-3">로그인이 필요합니다</h2>
        <Link href={ROUTES.LOGIN} className="btn-primary text-sm">로그인하기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="saramin-section p-5 flex items-center gap-3">
        <Link
          href={ROUTES.MYPAGE}
          className="p-2 rounded hover:bg-primary-50 transition-colors duration-200"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <p className="text-sm font-bold text-primary">My Page</p>
          <h1 className="text-2xl font-bold text-text-primary">비밀번호 변경</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-6">
        {error && <div className="p-4 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">{error}</div>}
        {success && <div className="p-4 rounded bg-state-new-bg border border-green-200 text-state-new text-sm">비밀번호가 변경되었습니다.</div>}

        <div className="space-y-1.5">
          <label htmlFor="currentPassword" className="block text-sm font-medium text-text-primary">
            현재 비밀번호 <span className="text-state-urgent">*</span>
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setError(null); setSuccess(false); }}
            className="input-field w-full"
            placeholder="현재 사용 중인 비밀번호"
            autoComplete="current-password"
          />
          <p className="text-xs text-gray-400">본인 확인을 위해 현재 비밀번호를 먼저 입력해주세요.</p>
        </div>

        <div className="border-t border-gray-100" />

        <div className="space-y-1.5">
          <label htmlFor="newPassword" className="block text-sm font-medium text-text-primary">
            새 비밀번호 <span className="text-state-urgent">*</span>
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setError(null); setSuccess(false); }}
            disabled={!currentPassword}
            className={`input-field w-full ${!currentPassword ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
            placeholder={currentPassword ? '6자 이상 입력' : '현재 비밀번호 입력 후 활성화'}
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary">
            새 비밀번호 확인 <span className="text-state-urgent">*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); setSuccess(false); }}
            disabled={!currentPassword}
            className={`input-field w-full ${!currentPassword ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
            placeholder={currentPassword ? '비밀번호 재입력' : '현재 비밀번호 입력 후 활성화'}
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={ROUTES.MYPAGE} className="btn-outline text-sm">취소</Link>
          <button
            type="submit"
            disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '변경 중...' : '변경하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
