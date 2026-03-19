'use client';

import { useEffect, useState, useCallback } from 'react';
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

  const supabase = createClient();

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .single();

          setState({ user, profile, isLoading: false });
        } else {
          setState({ user: null, profile: null, isLoading: false });
        }
      } catch {
        setState({ user: null, profile: null, isLoading: false });
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .is('deleted_at', null)
            .single();

          setState({ user: session.user, profile, isLoading: false });
        } else {
          setState({ user: null, profile: null, isLoading: false });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, profile: null, isLoading: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    user: state.user,
    profile: state.profile,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user,
    signOut,
  };
}
