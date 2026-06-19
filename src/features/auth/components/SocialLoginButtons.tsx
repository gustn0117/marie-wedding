'use client';

import { useState } from 'react';
import { authService } from '@/features/auth/services/auth-service';

interface Props {
  /** 가입 화면이면 'signup', 로그인 화면이면 'login'. 카피만 다름. */
  mode?: 'login' | 'signup';
  onError?: (msg: string) => void;
}

/**
 * 4개 provider 소셜 로그인 버튼 (Kakao / Naver / Google / Apple).
 *
 * - Kakao/Google/Apple: Supabase native (signInWithOAuth)
 * - Naver: 자체 라우트로 redirect (/auth/naver/start)
 *
 * 한 컴포넌트로 로그인·회원가입 페이지 양쪽에 재사용.
 */
export default function SocialLoginButtons({ mode = 'login', onError }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const verb = mode === 'signup' ? '시작하기' : '로그인';

  const handle = async (provider: 'kakao' | 'google') => {
    setLoading(provider);
    try {
      if (provider === 'kakao') await authService.signInWithKakao();
      if (provider === 'google') await authService.signInWithGoogle();
      // signInWithOAuth는 redirect를 발생시키므로 promise resolve 후엔 페이지가 이미 떠난 상태일 수 있음
    } catch {
      onError?.(`${labelOf(provider)} 로그인에 실패했어요. 잠시 후 다시 시도해주세요.`);
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <a
        href={`/auth/naver/start?next=${encodeURIComponent('/jobs')}`}
        className="flex items-center justify-center gap-2 h-11 rounded-lg bg-[#03C75A] text-white text-sm font-bold hover:opacity-90 transition-opacity"
      >
        <NaverIcon />
        <span>네이버로 {verb}</span>
      </a>

      <button
        type="button"
        onClick={() => handle('kakao')}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-[#FEE500] text-[#191919] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <KakaoIcon />
        <span>{loading === 'kakao' ? '카카오 연결 중…' : `카카오로 ${verb}`}</span>
      </button>

      <button
        type="button"
        onClick={() => handle('google')}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-white border border-gray-300 text-[#1f1f1f] text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <GoogleIcon />
        <span>{loading === 'google' ? 'Google 연결 중…' : `Google로 ${verb}`}</span>
      </button>
    </div>
  );
}

function labelOf(p: 'kakao' | 'google') {
  return p === 'kakao' ? '카카오' : 'Google';
}

function KakaoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.8 5.16 4.5 6.54-.18.66-.66 2.4-.75 2.76-.12.48.18.48.36.36.15-.09 2.34-1.59 3.3-2.25.84.12 1.71.18 2.59.18 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"
        fill="#3C1E1E"
      />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z" fill="#fff" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.501 12.233c0-.85-.073-1.49-.231-2.157H12.214v3.913h5.916c-.119.987-.764 2.475-2.196 3.474l-.02.132 3.19 2.448.221.022c2.03-1.866 3.2-4.61 3.2-7.832z" fill="#4285F4" />
      <path d="M12.214 22.5c2.901 0 5.337-.95 7.116-2.586l-3.391-2.602c-.908.63-2.126 1.07-3.725 1.07-2.842 0-5.255-1.866-6.117-4.444l-.126.011-3.318 2.543-.043.12C4.382 19.778 7.99 22.5 12.214 22.5z" fill="#34A853" />
      <path d="M6.097 13.938a6.86 6.86 0 0 1-.376-2.188c0-.762.137-1.501.363-2.188l-.006-.146-3.36-2.583-.11.052A11.193 11.193 0 0 0 1.5 11.75c0 1.808.438 3.515 1.21 5.014l3.387-2.826z" fill="#FBBC05" />
      <path d="M12.214 4.318c2.018 0 3.379.864 4.156 1.585l3.034-2.93C17.547 1.28 15.115.5 12.214.5 7.99.5 4.382 3.222 2.61 7.165l3.475 2.7c.875-2.577 3.288-4.443 6.13-4.443z" fill="#EB4335" />
    </svg>
  );
}

