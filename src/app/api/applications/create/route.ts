import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 지원/문의 접수 (service_role) — 클라이언트 .insert().select().single() 이
 * RLS/트리거로 hang 하던 문제 우회. 지원자는 SSR 세션에서 서버가 직접 판별.
 * Body: { jobId, message, contactPhone? }
 */
export async function POST(request: Request) {
  let body: { jobId?: string; message?: string; contactPhone?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const jobId = body.jobId;
  const message = (body.message ?? '').trim();
  const contactPhone = body.contactPhone?.trim() || null;
  if (!jobId || message.length < 10) {
    return NextResponse.json({ error: '지원 내용을 10자 이상 입력해주세요.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(SUPABASE_SERVER_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
    },
  });
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const service = createServiceClient();
  const { data: me } = await service
    .from('profiles')
    .select('id, banned_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });

  const { data, error } = await service
    .from('applications')
    .insert({ job_id: jobId, applicant_id: me.id, message, contact_phone: contactPhone })
    .select('*, job:jobs(*), applicant:profiles(*)')
    .single();
  if (error) {
    const dup = error.message.includes('duplicate') || error.code === '23505';
    return NextResponse.json({ error: dup ? '이미 접수된 내역이 있습니다.' : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ data });
}
