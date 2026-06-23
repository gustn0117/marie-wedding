'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

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
  const cookieProfile = getCookieProfile();

  const [state, setState] = useState<AuthState>({
    user: null,
    profile: cookieProfile,
    isLoading: !cookieProfile,
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

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({ user: session.user, profile, isLoading: false });
        } else {
          setState({ user: null, profile: null, isLoading: false });
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
    document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
