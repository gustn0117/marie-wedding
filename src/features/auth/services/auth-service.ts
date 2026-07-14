import { apiFetch } from '@/shared/utils/apiFetch';
import { abortAfter } from '@/shared/utils/withTimeout';
import { createClient } from '@/lib/supabase/client';

export const authService = {
  async signUp(email: string, password: string, metadata: {
    accountType: 'individual' | 'business';
    contactName: string;
    regions: string[];
    businessTypes?: string[];
    companyName?: string;
    phone?: string;
    verifyMethod?: 'email' | 'phone';
  }) {
    // 가입 API와 직후 로그인을 하나의 취소 가능한 deadline 안에서 끝낸다.
    // UI만 먼저 timeout되고 백그라운드 가입이 계속되는 중복 가입 상태를 막는다.
    const { signal, clear } = abortAfter(30_000);
    try {
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          accountType: metadata.accountType,
          contactName: metadata.contactName,
          regions: metadata.regions,
          businessTypes: metadata.businessTypes,
          companyName: metadata.companyName,
          phone: metadata.phone,
          verifyMethod: metadata.verifyMethod,
        }),
        signal,
      }, 22_000);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const supabase = createClient(signal);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      return data;
    } catch (error) {
      if (signal.aborted) {
        throw new Error('회원가입 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    } finally {
      clear();
    }
  },

  async signIn(email: string, password: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async signInWithKakao() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  },

  async getSession() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  async getCurrentProfile() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const res = await apiFetch('/api/profile/me', { credentials: 'include', cache: 'no-store' });
    const body = await res.json().catch(() => ({ error: '프로필을 불러오지 못했습니다.' }));
    if (!res.ok) throw new Error(body.error || '프로필을 불러오지 못했습니다.');
    return body.profile;
  },
};
