'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

const PROFILE_CACHE_KEY = 'marie_cached_profile';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

function getCachedProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setCachedProfile(profile: Profile | null) {
  if (typeof window === 'undefined') return;
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {}
}

export function useAuth() {
  const cachedProfile = getCachedProfile();

  const [state, setState] = useState<AuthState>({
    user: null,
    profile: cachedProfile,
    isLoading: false,
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
          setCachedProfile(profile);
          setState({ user: session.user, profile, isLoading: false });
        } else {
          setCachedProfile(null);
          setState({ user: null, profile: null, isLoading: false });
        }
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            setCachedProfile(profile);
            setState({ user: session.user, profile, isLoading: false });
          }
        } else if (event === 'SIGNED_OUT') {
          setCachedProfile(null);
          setState({ user: null, profile: null, isLoading: false });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    setCachedProfile(null);
    setState({ user: null, profile: null, isLoading: false });
    await supabaseRef.current.auth.signOut();
  }, []);

  return {
    user: state.user,
    profile: state.profile,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user || !!state.profile,
    signOut,
  };
}
