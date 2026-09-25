'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { authService } from '@/features/auth/services/auth-service';
import { withTimeout } from '@/shared/utils/withTimeout';
import { ROUTES } from '@/shared/constants';
import SocialLoginButtons from '@/features/auth/components/SocialLoginButtons';
import type { LoginFormData } from '@/features/auth/types';

/** 로그인 창(LoginModal)의 aria-labelledby 대상 */
export const LOGIN_DIALOG_TITLE_ID = 'login-dialog-title';

interface LoginFormProps {
  /**
   * page: /login 페이지 — 브랜드 머리글이 있는 카드.
   * modal: PC에서 로그인을 눌렀을 때 보던 화면 위에 뜨는 로그인 창(LoginModalHost).
   */
  variant?: 'page' | 'modal';
  /** 로그인 후 돌아갈 경로. 창은 주소가 바뀌지 않으므로 직접 넘긴다. 없으면 ?redirect= 를 쓴다. */
  redirect?: string;
}

export default function LoginForm({ variant = 'page', redirect: redirectProp }: LoginFormProps) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fieldId = useId();

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
      // redirect 쿼리 파라미터 처리 — 로그인 링크(loginHref)·미들웨어가 원래 보던 경로를 붙인다.
      // 로그인 창에서도 그 경로로 새로 불러와(전체 이동) 헤더 등 로그인 상태가 한 번에 반영된다.
      // open-redirect 방지: 브라우저와 동일한 URL 파서로 정규화 후 same-origin 만 허용
      // (백슬래시/스킴 우회 차단: new URL('/\\evil.com', origin) → https://evil.com)
      const redirect = redirectProp ?? new URLSearchParams(window.location.search).get('redirect');
      let safeRedirect: string = ROUTES.HOME;
      if (redirect) {
        try {
          const u = new URL(redirect, window.location.origin);
          if (u.origin === window.location.origin) {
            safeRedirect = u.pathname + u.search + u.hash;
          }
        } catch {
          // malformed → fall back to HOME
        }
      }
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

  const body = (
    <>
      {error && (
        <div role="alert" className="mb-5 p-3 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor={`${fieldId}-email`} className="sr-only">이메일</label>
          <input
            id={`${fieldId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="이메일"
            className="input-field h-[52px]"
          />
        </div>

        <div className="relative">
          <label htmlFor={`${fieldId}-password`} className="sr-only">비밀번호</label>
          <input
            id={`${fieldId}-password`}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleChange}
            placeholder="비밀번호"
            className="input-field h-[52px] pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-1 my-auto inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-gray-700"
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="!mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
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

      <div className="my-7 flex items-center gap-3 text-xs text-gray-400">
        <span aria-hidden className="h-px flex-1 bg-gray-200" />
        소셜 계정으로 간편 로그인
        <span aria-hidden className="h-px flex-1 bg-gray-200" />
      </div>

      <SocialLoginButtons mode="login" onError={setError} next={redirectProp} />

      <p className="mt-7 flex items-center justify-center border-t border-gray-100 pt-5 text-sm text-gray-600">
        <Link href={ROUTES.FORGOT_PASSWORD} className="inline-flex h-11 items-center px-3 underline-offset-4 hover:text-ink hover:underline">
          비밀번호 찾기
        </Link>
        <span aria-hidden className="h-3 w-px bg-gray-300" />
        <Link href={ROUTES.SIGNUP} className="inline-flex h-11 items-center px-3 font-semibold text-primary underline-offset-4 hover:underline">
          회원가입
        </Link>
      </p>
    </>
  );

  if (variant === 'modal') {
    return (
      <div className="px-6 pb-6 pt-14 sm:px-10 md:px-12 md:pt-12">
        <h2 id={LOGIN_DIALOG_TITLE_ID} className="text-[26px] font-bold tracking-tight text-ink">
          <span className="bg-[linear-gradient(transparent_62%,theme(colors.primary.100)_62%)] px-0.5">로그인</span>
        </h2>
        <p className="mb-8 mt-3 text-[15px] leading-relaxed text-gray-600">
          마리에 로그인 후,
          <br />
          더욱 편리한 서비스를 이용해 보세요.
        </p>
        {body}
      </div>
    );
  }

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
        {body}
      </div>
    </div>
  );
}
