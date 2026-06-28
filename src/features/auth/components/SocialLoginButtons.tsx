'use client';

import { useState } from 'react';
import { authService } from '@/features/auth/services/auth-service';

interface Props {
  /** 가입 화면이면 'signup', 로그인 화면이면 'login'. 카피만 다름. */
  mode?: 'login' | 'signup';
  onError?: (msg: string) => void;
}

/**
 * 2개 provider 소셜 로그인 버튼 (Naver / Kakao).
 *
 * - Kakao: Supabase native (signInWithOAuth)
 * - Naver: 자체 라우트로 redirect (/auth/naver/start)
 *
 * 한 컴포넌트로 로그인·회원가입 페이지 양쪽에 재사용.
 */
export default function SocialLoginButtons({ mode = 'login', onError }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const verb = mode === 'signup' ? '시작하기' : '로그인';

  const handleKakao = async () => {
    setLoading('kakao');
    // 8초 후에도 redirect 안 일어났으면 OAuth가 hang한 것으로 간주 — 버튼 잠금 해제
    const safety = setTimeout(() => {
      setLoading((prev) => (prev === 'kakao' ? null : prev));
      onError?.('카카오 로그인이 응답하지 않아요. 다시 시도해주세요.');
    }, 8000);
    try {
      await authService.signInWithKakao();
      // signInWithOAuth는 redirect를 발생시키므로 promise resolve 후엔 페이지가 이미 떠난 상태일 수 있음
    } catch {
      onError?.('카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
      setLoading(null);
    } finally {
      clearTimeout(safety);
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
        onClick={handleKakao}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-[#FEE500] text-[#191919] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <KakaoIcon />
        <span>{loading === 'kakao' ? '카카오 연결 중…' : `카카오로 ${verb}`}</span>
      </button>
    </div>
  );
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
