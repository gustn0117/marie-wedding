'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { createClient } from '@/lib/supabase/client';
import { withTimeout } from '@/shared/utils/withTimeout';

// 'change' = 이미 비밀번호가 있는 계정(이메일 가입) → 현재 비밀번호 확인 후 변경
// 'set'    = 소셜(카카오·네이버·구글)로만 가입해 비밀번호가 없는 계정 → 새로 설정
type Mode = 'loading' | 'change' | 'set';

/** 로그인 방식으로 비밀번호 보유 여부를 추정한다.
 *  - 네이버(커스텀 OAuth)는 user_metadata.provider='naver' 로 생성되고 비밀번호가 없다.
 *  - 카카오·구글(Supabase 네이티브)은 app_metadata.provider 가 해당 소셜이다.
 *  - 이메일 가입만 실제 비밀번호를 가진다. */
function detectMode(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null): Mode {
  if (!user) return 'loading';
  const um = user.user_metadata ?? {};
  const am = user.app_metadata ?? {};
  if (um.provider === 'naver') return 'set';
  const provider = am.provider as string | undefined;
  if (provider === 'kakao' || provider === 'google' || provider === 'naver') return 'set';
  const providers = (am.providers as string[] | undefined) ?? [];
  if (providers.length > 0 && !providers.includes('email')) return 'set';
  return 'change';
}

export default function ChangePasswordPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<Mode>('loading');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 마운트 시 실제 계정을 조회해 비밀번호 보유 여부(변경 vs 설정)를 판별.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await withTimeout(supabase.auth.getUser(), 12000, '계정 확인 지연');
        if (alive) setMode(detectMode(data.user));
      } catch {
        // 조회 실패 시 안전하게 '변경' 모드(현재 비밀번호 요구)로 둔다.
        if (alive) setMode('change');
      }
    })();
    return () => { alive = false; };
  }, []);

  const isSetMode = mode === 'set';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSetMode && !currentPassword) {
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
    if (!isSetMode && newPassword === currentPassword) {
      setError('새 비밀번호가 현재 비밀번호와 같습니다.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();

      // 변경 모드: 현재 비밀번호를 재인증(signInWithPassword)으로 검증한 뒤 변경.
      if (!isSetMode) {
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
      }

      // 새 비밀번호 설정/변경 (설정 모드는 소셜 계정에 비밀번호를 추가로 부여)
      const { error: updateError } = await withTimeout(
        supabase.auth.updateUser({ password: newPassword }),
        12000,
        '비밀번호 처리 지연',
      );
      if (updateError) throw updateError;
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 처리에 실패했습니다.');
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

  const title = isSetMode ? '비밀번호 설정' : '비밀번호 변경';
  const newFieldsEnabled = isSetMode || !!currentPassword;

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
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-6">
        {error && <div className="p-4 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">{error}</div>}
        {success && (
          <div className="p-4 rounded bg-state-new-bg border border-green-200 text-state-new text-sm">
            {isSetMode ? '비밀번호가 설정되었습니다. 이제 이메일 + 비밀번호로도 로그인할 수 있어요.' : '비밀번호가 변경되었습니다.'}
          </div>
        )}

        {mode === 'loading' ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 rounded bg-gray-100" />
            <div className="h-10 rounded bg-gray-100" />
          </div>
        ) : (
          <>
            {isSetMode ? (
              <div className="p-4 rounded bg-primary-50/60 border border-primary-100 text-[13px] text-gray-600 leading-relaxed">
                카카오·네이버·구글로 로그인한 계정이라 비밀번호가 없습니다.
                비밀번호를 설정하면 이메일 + 비밀번호로도 로그인할 수 있어요.
                (소셜 로그인은 계속 사용할 수 있습니다.)
              </div>
            ) : (
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
            )}

            {!isSetMode && <div className="border-t border-gray-100" />}

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
          </>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={ROUTES.MYPAGE} className="btn-outline text-sm">취소</Link>
          <button
            type="submit"
            disabled={submitting || mode === 'loading' || !newPassword || !confirmPassword || (!isSetMode && !currentPassword)}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '처리 중...' : (isSetMode ? '설정하기' : '변경하기')}
          </button>
        </div>
      </form>
    </div>
  );
}
