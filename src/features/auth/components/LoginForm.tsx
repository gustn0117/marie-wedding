'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authService } from '@/features/auth/services/auth-service';
import { withTimeout } from '@/shared/utils/withTimeout';
import { ROUTES } from '@/shared/constants';
import SocialLoginButtons from '@/features/auth/components/SocialLoginButtons';
import type { LoginFormData } from '@/features/auth/types';

export default function LoginForm() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OAuth 콜백 에러 처리 — provider를 노출하지 않는 generic 메시지
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const err = sp.get('error');
    if (!err) return;
    const messages: Record<string, string> = {
      conflict: '이미 등록된 이메일입니다. 로그인 페이지에서 시도해 주세요.',
      auth_failed: '로그인에 실패했어요. 다시 시도해주세요.',
      naver_denied: '네이버 로그인이 취소되었어요.',
      naver_state_mismatch: '보안 검증에 실패했어요. 다시 시도해주세요.',
      naver_token_failed: '네이버 인증 처리에 실패했어요.',
      naver_profile_failed: '네이버 정보를 가져오지 못했어요.',
      naver_create_failed: '계정 생성에 실패했어요.',
      naver_session_failed: '로그인 세션 생성에 실패했어요.',
      naver_config: '네이버 로그인 설정이 완료되지 않았습니다.',
      naver_invalid_request: '잘못된 요청이에요.',
      naver_no_id: '네이버에서 사용자 정보를 받지 못했어요.',
    };
    setError(messages[err] ?? '로그인에 실패했어요. 다시 시도해주세요.');
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await withTimeout(authService.signIn(formData.email, formData.password), 10000);
      // redirect 쿼리 파라미터 처리 — 어드민 접근 시 미들웨어가 추가함
      const sp = new URLSearchParams(window.location.search);
      const redirect = sp.get('redirect');
      const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : ROUTES.HOME;
      window.location.href = safeRedirect;
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else {
          setError(err.message);
        }
      } else {
        setError('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-surface rounded border border-border p-8 shadow-sm">
        {/* Brand — 헤더와 동일한 타이포그래피, 로고 마크 제거 */}
        <div className="flex flex-col items-center text-center mb-8 gap-2">
          <Link href={ROUTES.HOME} className="text-4xl font-bold tracking-tight text-ink" aria-label="Marié 홈">
            Marié
          </Link>
          <p className="text-sm text-text-secondary">웨딩업계 구인구직 플랫폼</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="example@company.com"
              className="input-field"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-text-primary">
                비밀번호
              </label>
              <Link href={ROUTES.FORGOT_PASSWORD} className="text-xs font-semibold text-gray-500 hover:text-primary">
                비밀번호 찾기
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요"
              className="input-field"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-3 text-text-muted">
              소셜 계정으로 간편 로그인
            </span>
          </div>
        </div>

        {/* Social Login */}
        <SocialLoginButtons mode="login" onError={setError} />

        <div className="mt-6" />

        {/* Signup Link */}
        <p className="text-center text-sm text-text-secondary">
          아직 계정이 없으신가요?{' '}
          <Link
            href={ROUTES.SIGNUP}
            className="font-medium text-primary hover:text-primary-dark transition-colors"
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
