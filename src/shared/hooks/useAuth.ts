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

export function useAuth() {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            setState({ user: session.user, profile, isLoading: false });
          } else {
            setState({ user: null, profile: null, isLoading: false });
          }
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, profile: null, isLoading: false });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabaseRef.current.auth.signOut();
    setState({ user: null, profile: null, isLoading: false });
  }, []);

  return {
    user: state.user,
    profile: state.profile,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user,
    signOut,
  };
}
