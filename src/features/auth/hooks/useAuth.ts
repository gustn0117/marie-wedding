'use client';

// Re-export from shared for consistency across the app.
// This wrapper preserves the `loading` alias used by feature components.
import { useAuth as useSharedAuth } from '@/shared/hooks/useAuth';

export function useAuth() {
  const { user, profile, isLoading, isAuthenticated, signOut } = useSharedAuth();
  return { user, profile, loading: isLoading, isAuthenticated, signOut };
}
