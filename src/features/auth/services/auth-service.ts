import { createClient } from '@/lib/supabase/client';

export const authService = {
  async signUp(email: string, password: string, metadata: {
    businessType: string;
    companyName: string;
    contactName: string;
    region: string;
  }) {
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error('회원가입에 실패했습니다.');

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: authData.user.id,
      business_type: metadata.businessType,
      company_name: metadata.companyName,
      contact_name: metadata.contactName,
      region: metadata.region,
    });
    if (profileError) throw profileError;

    return authData;
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

  async getSession() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  async getCurrentProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error) throw error;
    return data;
  },
};
