'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';
import { clearMarieProfileCookie } from '@/shared/utils/cookieHelpers';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

// Read marie_profile cookie for instant display
function getCookieProfile(): Profile | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(/marie_profile=([^;]+)/);
    if (match) return JSON.parse(decodeURIComponent(match[1]));
  } catch {}
  return null;
}

export function useAuth() {
  // SSR과 hydration 결과를 일치시키기 위해 초기값은 항상 null/true로.
  // 클라이언트 cookie는 mount 후 effect에서 읽는다.
  // (이전: useState 초기값으로 getCookieProfile() 호출 → SSR=null, hydration=cookie → mismatch 발생)
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
  });

  const supabaseRef = useRef(createClient());

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data } = await supabaseRef.current
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    return data as Profile | null;
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;

    // 마운트 즉시 cookie의 profile을 우선 반영 (UI 첫 노출 빠르게)
    // 미들웨어는 유효 세션에만 marie_profile 쿠키를 설정한다 → '쿠키 존재 = 인증됨'.
    // 따라서 네트워크(getSession/fetchProfile) 완료를 기다리지 않고 즉시 isLoading 을 해제해
    // 로그인 UI 를 노출한다. user 와 최신 profile 은 아래 initSession 이 백그라운드로 채운다.
    // (이 setState 는 마운트 후 effect 에서만 실행되므로 SSR hydration 불일치와 무관)
    const cookieProfile = getCookieProfile();
    if (cookieProfile) {
      setState((prev) => ({ ...prev, profile: cookieProfile, isLoading: false }));
    }

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          // fetchProfile 이 일시적으로 null 을 반환해도(네트워크/RLS 순간 실패)
          // 쿠키 profile 이 있으면 그것을 유지 — 로그인 상태 유실 방지.
          setState((prev) => ({ user: session.user, profile: profile ?? prev.profile, isLoading: false }));
        } else {
          // 클라이언트 getSession 이 세션을 못 읽어도(쿠키 리프레시 실패 등),
          // 서버 미들웨어가 검증해 세팅한 marie_profile 쿠키가 있으면 로그인 상태로 간주한다.
          // 미들웨어는 유효 세션에만 쿠키를 세팅하고 로그아웃/탈퇴 시 제거하므로 '쿠키 존재 = 인증됨'.
          // (mypage/edit 등의 저장은 서버 라우트로 인증되므로 클라 세션이 없어도 정상 동작)
          setState((prev) => ({ user: null, profile: prev.profile, isLoading: false }));
        }
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    // Set a timeout so loading never hangs forever
    const timeout = setTimeout(() => {
      setState(prev => {
        if (prev.isLoading) return { ...prev, isLoading: false };
        return prev;
      });
    }, 5000);

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            setState({ user: session.user, profile, isLoading: false });
          }
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, profile: null, isLoading: false });
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    // 클라이언트 측 즉시 정리
    clearMarieProfileCookie();
    setState({ user: null, profile: null, isLoading: false });

    // localStorage / sessionStorage의 supabase 세션 토큰 모두 제거
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-')) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('sb-')) sessionStorage.removeItem(k);
      });
    } catch {}

    // 서버 라우트로 supabase auth cookie 확실히 expire
    try {
      await Promise.race([
        fetch('/api/auth/signout', { method: 'POST', credentials: 'include' }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('signout_timeout')), 3000)),
      ]);
    } catch {}

    // 클라이언트 supabase signOut (in-memory session 정리)
    try {
      await Promise.race([
        supabaseRef.current.auth.signOut(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('signout_timeout')), 2000)),
      ]);
    } catch {}
  }, []);

  return {
    user: state.user,
    profile: state.profile,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user || !!state.profile,
    signOut,
  };
}
