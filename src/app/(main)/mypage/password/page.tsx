'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { createClient } from '@/lib/supabase/client';

export default function ChangePasswordPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setSuccess(true);
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
        <h2 className="text-xl font-semibold text-text-primary mb-3">로그인이 필요합니다</h2>
        <Link href={ROUTES.LOGIN} className="btn-primary text-sm">로그인하기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.MYPAGE}
          className="p-2 rounded-lg hover:bg-secondary transition-colors duration-200"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">비밀번호 변경</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-6">
        {error && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">비밀번호가 변경되었습니다.</div>}

        <div className="space-y-1.5">
          <label htmlFor="newPassword" className="block text-sm font-medium text-text-primary">
            새 비밀번호 <span className="text-red-500">*</span>
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setError(null); setSuccess(false); }}
            className="input-field w-full"
            placeholder="6자 이상 입력"
            minLength={6}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary">
            새 비밀번호 확인 <span className="text-red-500">*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); setSuccess(false); }}
            className="input-field w-full"
            placeholder="비밀번호 재입력"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={ROUTES.MYPAGE} className="btn-outline text-sm">취소</Link>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">
            {submitting ? '변경 중...' : '변경하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
