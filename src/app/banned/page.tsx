import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerQueryClient } from '@/lib/supabase/server-query';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '계정 이용 제한 | Marié',
};

export default async function BannedPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect('/login');

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect('/login'); }
  if (!me?.id) redirect('/login');

  const supabase = createServerQueryClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('contact_name, banned_at, banned_reason')
    .eq('id', me.id)
    .single();

  // 제재 해제된 사용자는 홈으로
  if (!profile?.banned_at) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full border border-gray-300 bg-white p-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Account Restricted</p>
        <h1 className="text-xl font-bold text-gray-900 mb-3">계정 이용이 제한되었습니다</h1>
        <p className="text-sm text-gray-600 mb-5 whitespace-pre-wrap">
          {profile.banned_reason || '관리자에 의해 계정 이용이 제한되었습니다.'}
        </p>
        <p className="text-xs text-gray-500 mb-4">
          제재일: {new Date(profile.banned_at).toLocaleString('ko-KR')}
        </p>
        <p className="text-xs text-gray-500">
          이의가 있으시면 <a href="/contact" className="underline">고객센터</a>로 문의 주세요.
        </p>
      </div>
    </main>
  );
}
