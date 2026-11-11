'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authService } from '@/features/auth/services/auth-service';
import {
  authorizeWithApple,
  authorizeWithKakaoTalk,
  canSignInWithApple,
  canSignInWithKakaoTalk,
} from '@/shared/utils/appShell';

interface Props {
  /** 가입 화면이면 'signup', 로그인 화면이면 'login'. 카피만 다름. */
  mode?: 'login' | 'signup';
  onError?: (msg: string) => void;
  /** 로그인 후 돌아갈 경로. 없으면 로그인 페이지의 ?redirect= 를 쓴다(로그인 창은 주소가 안 바뀌어 직접 넘김). */
  next?: string;
}

/** 로그인 페이지의 redirect 파라미터를 안전한 내부 경로로만 허용(오픈리다이렉트 방지). */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/jobs';
  return value;
}

/**
 * 소셜 로그인 버튼 (Apple / Naver / Kakao).
 *
 * - Apple: iOS 앱에서만 보인다(.app-only). 앱의 네이티브 애플 로그인 창 → /api/auth/apple 이 세션으로 바꾼다.
 *   카카오·네이버를 쓰는 앱은 앱스토어 심사 기준(4.8)상 애플 로그인을 같은 크기 이상으로 함께 보여야 해 맨 위에 둔다.
 * - Kakao: 앱(1.0 빌드 4부터)은 카카오톡 앱으로 바로 로그인(KakaoLogin 플러그인 → /api/auth/kakao).
 *   웹, 카카오톡이 없는 폰, 카카오톡 로그인이 실패했을 때는 Supabase native (signInWithOAuth) — 카카오 계정 화면.
 * - Naver: 자체 라우트로 redirect (/auth/naver/start)
 *
 * 한 컴포넌트로 로그인·회원가입 페이지 양쪽에 재사용.
 */
/**
 * useSearchParams 를 쓰는 실제 본체. /login·/signup 은 정적 프리렌더 대상이라
 * Suspense 경계 없이 useSearchParams 를 쓰면 빌드가 깨진다(missing-suspense-with-csr-bailout).
 * 반드시 아래 기본 export 의 Suspense 래퍼를 통해서만 렌더한다.
 */
function SocialLoginButtonsInner({ mode = 'login', onError, next: nextProp }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const searchParams = useSearchParams();
  // 로그인 화면이 ?redirect=... 로 원래 목적지를 전달한다. 소셜 로그인도 이를 존중한다.
  const next = safeNext(nextProp ?? searchParams.get('redirect'));

  const verb = mode === 'signup' ? '시작하기' : '로그인';

  const handleKakao = async () => {
    setLoading('kakao');
    // 앱은 카카오톡 앱으로 먼저 — 카카오톡에 로그인돼 있으면 아이디·비밀번호를 다시 넣지 않는다.
    // 카카오톡이 없거나 잘 안 되면 아래 웹 로그인(카카오 계정 화면)으로 이어 간다.
    if (canSignInWithKakaoTalk()) {
      const talk = await signInWithKakaoTalk(next);
      if (talk === 'redirected') return;
      if (talk === 'canceled') {
        setLoading(null);
        return;
      }
      if (talk === 'account_removed') {
        onError?.('이용할 수 없는 계정이에요. 고객센터로 문의해 주세요.');
        setLoading(null);
        return;
      }
    }
    // 8초 후에도 redirect 안 일어났으면 OAuth가 hang한 것으로 간주 — 버튼 잠금 해제
    const safety = setTimeout(() => {
      setLoading((prev) => (prev === 'kakao' ? null : prev));
      onError?.('카카오 로그인이 응답하지 않아요. 다시 시도해주세요.');
    }, 8000);
    try {
      await authService.signInWithKakao(next);
      // signInWithOAuth는 redirect를 발생시키므로 promise resolve 후엔 페이지가 이미 떠난 상태일 수 있음
    } catch {
      onError?.('카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
      setLoading(null);
    } finally {
      clearTimeout(safety);
    }
  };

  const handleApple = async () => {
    if (!canSignInWithApple()) {
      onError?.('Apple 로그인을 쓰려면 앱을 최신 버전으로 업데이트해 주세요.');
      return;
    }
    setLoading('apple');
    try {
      const nonce = randomNonce();
      const credential = await authorizeWithApple(nonce);
      const res = await fetch('/api/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          identityToken: credential.identityToken,
          nonce,
          givenName: credential.givenName ?? null,
          familyName: credential.familyName ?? null,
          next,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok || !data.redirect) {
        onError?.(
          data.error === 'account_removed'
            ? '이용할 수 없는 계정이에요. 고객센터로 문의해 주세요.'
            : 'Apple 로그인에 실패했어요. 잠시 후 다시 시도해주세요.',
        );
        setLoading(null);
        return;
      }
      // 서버가 세션 쿠키를 심었다 — 새로 읽어 머리글 등 서버 화면이 로그인 상태로 그려지게 한다.
      window.location.href = data.redirect;
    } catch (e) {
      setLoading(null);
      // 사용자가 애플 창을 닫은 것은 오류가 아니다.
      if ((e as { code?: string } | null)?.code === 'CANCELED') return;
      onError?.('Apple 로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleApple}
        disabled={!!loading}
        className={APPLE_BUTTON_CLASS}
        style={APPLE_BUTTON_FONT}
      >
        <AppleIcon />
        <span>{loading === 'apple' ? 'Apple 연결 중…' : mode === 'signup' ? 'Apple로 계속하기' : 'Apple로 로그인'}</span>
      </button>

      <a
        href={`/auth/naver/start?next=${encodeURIComponent(next)}`}
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

// Suspense fallback — 하이드레이션 전 잠깐 보이는 정적 골격. 실제 버튼과 동일 높이·색으로
// 레이아웃 시프트를 없앤다(비상호작용). next 파라미터는 하이드레이션 후 본체가 채운다.
function SocialLoginButtonsFallback({ mode = 'login' }: Pick<Props, 'mode'>) {
  const verb = mode === 'signup' ? '시작하기' : '로그인';
  return (
    <div className="space-y-2" aria-hidden>
      <div className={`${APPLE_BUTTON_CLASS} opacity-70`} style={APPLE_BUTTON_FONT}>
        <AppleIcon />
        <span>{mode === 'signup' ? 'Apple로 계속하기' : 'Apple로 로그인'}</span>
      </div>
      <div className="flex items-center justify-center gap-2 h-11 rounded-lg bg-[#03C75A] text-white text-sm font-bold opacity-70">
        <NaverIcon />
        <span>네이버로 {verb}</span>
      </div>
      <div className="flex items-center justify-center gap-2 h-11 rounded-lg bg-[#FEE500] text-[#191919] text-sm font-bold opacity-70">
        <KakaoIcon />
        <span>카카오로 {verb}</span>
      </div>
    </div>
  );
}

export default function SocialLoginButtons(props: Props) {
  return (
    <Suspense fallback={<SocialLoginButtonsFallback mode={props.mode} />}>
      <SocialLoginButtonsInner {...props} />
    </Suspense>
  );
}

// 애플 로그인 버튼 — 애플 안내(검은 바탕·흰 로고·시스템 글꼴)를 따른다. 앱에서만 보인다.
const APPLE_BUTTON_CLASS =
  'app-only w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-black text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50';
const APPLE_BUTTON_FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' } as const;

type KakaoTalkOutcome = 'redirected' | 'canceled' | 'account_removed' | 'fallback';

/**
 * 앱에서 카카오톡 앱으로 로그인한다. 카카오톡이 준 ID 토큰을 /api/auth/kakao 가 세션으로 바꾼다.
 * 'fallback' 이면 부르는 쪽이 웹 로그인으로 이어 간다 — 카카오톡이 없거나, 카카오·인증 서버 설정 문제로
 * 토큰이 통하지 않을 때도 로그인은 되게 한다(실패는 서버 로그 [auth/kakao] 에 남는다).
 */
async function signInWithKakaoTalk(next: string): Promise<KakaoTalkOutcome> {
  const nonce = randomNonce();
  let idToken: string;
  try {
    idToken = (await authorizeWithKakaoTalk(nonce)).idToken;
  } catch (e) {
    // 카카오톡에서 취소했거나 아무것도 안 하고 돌아온 것은 오류가 아니다.
    return (e as { code?: string } | null)?.code === 'CANCELED' ? 'canceled' : 'fallback';
  }
  if (typeof idToken !== 'string' || !idToken) return 'fallback';

  try {
    const res = await fetch('/api/auth/kakao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken, nonce, next }),
    });
    const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
    if (res.ok && data.redirect) {
      // 서버가 세션 쿠키를 심었다 — 새로 읽어 머리글 등 서버 화면이 로그인 상태로 그려지게 한다.
      window.location.href = data.redirect;
      return 'redirected';
    }
    if (data.error === 'account_removed') return 'account_removed';
  } catch {
    // 연결 오류 — 웹 로그인으로 이어 간다.
  }
  return 'fallback';
}

/** 애플·카카오톡 로그인에 쓰는 일회용 임의 문자열(32바이트, 16진수) */
function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
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
