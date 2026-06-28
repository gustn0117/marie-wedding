import { createClient } from '@/lib/supabase/client';

export const authService = {
  async signUp(email: string, password: string, metadata: {
    accountType: 'individual' | 'business';
    contactName: string;
    regions: string[];
    businessTypes?: string[];
    companyName?: string;
  }) {
    // Use API route for signup (service_role key, bypasses RLS)
    const res = await fetch('/api/auth/signup', {
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
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Sign in after successful signup
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;

    return data;
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

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    if (error) throw error;
    return data;
  },
};
