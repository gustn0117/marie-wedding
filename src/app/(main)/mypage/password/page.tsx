'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { createClient } from '@/lib/supabase/client';
import { withTimeout } from '@/shared/utils/withTimeout';
import type { Profile } from '@/types/database';
import type { User } from '@supabase/supabase-js';

/** 소셜(카카오·네이버·구글) 로그인 계정인지 판별 — 비밀번호가 없어 변경 불가.
 *  1순위: profile.signup_provider (미들웨어가 쿠키에 넣어줘 네트워크 없이 즉시 사용).
 *  2순위(구계정 등 signup_provider 누락 시): 세션 user 의 provider 메타데이터.
 *  둘 다 애매하면 이메일 계정으로 간주(변경 허용). */
function isSocialAccount(profile: Profile | null, user: User | null): boolean {
  const sp = profile?.signup_provider;
  if (sp === 'kakao' || sp === 'google' || sp === 'naver') return true;
  if (sp === 'email') return false;

  if (user) {
    const um = (user.user_metadata ?? {}) as Record<string, unknown>;
    const am = (user.app_metadata ?? {}) as Record<string, unknown>;
    if (um.provider === 'naver') return true;
    const p = am.provider as string | undefined;
    if (p === 'kakao' || p === 'google' || p === 'naver') return true;
    const providers = (am.providers as string[] | undefined) ?? [];
    if (providers.length > 0 && !providers.includes('email')) return true;
  }
  return false;
}

export default function ChangePasswordPage() {
  const { isLoading, isAuthenticated, profile, user } = useAuth();
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

      // 현재 비밀번호를 재인증(signInWithPassword)으로 검증한 뒤 변경.
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

  const social = isSocialAccount(profile, user);
  const newFieldsEnabled = !!currentPassword;

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

      {social ? (
        // 소셜 로그인 계정 — 비밀번호가 없으므로 변경 자체를 제공하지 않는다.
        <div className="card p-6 md:p-8 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text-primary">비밀번호 변경이 필요 없어요</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            카카오·네이버·구글로 로그인하는 계정은 비밀번호가 없습니다.<br />
            해당 소셜 서비스로 로그인해 이용해주세요.
          </p>
          <Link href={ROUTES.MYPAGE} className="btn-outline text-sm inline-flex mt-1">마이페이지로</Link>
        </div>
      ) : (
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
              disabled={!newFieldsEnabled}
              className={`input-field w-full ${!newFieldsEnabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
              placeholder={newFieldsEnabled ? '6자 이상 입력' : '현재 비밀번호 입력 후 활성화'}
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
              disabled={!newFieldsEnabled}
              className={`input-field w-full ${!newFieldsEnabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
              placeholder={newFieldsEnabled ? '비밀번호 재입력' : '현재 비밀번호 입력 후 활성화'}
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
      )}
    </div>
  );
}
