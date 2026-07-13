import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 내 전체 프로필 조회 — 서버(service_role)로 확실히 반환.
 * 클라이언트 .from('profiles').select() 는 세션 토큰 준비 지연/RLS 로 실패해
 * 업종·소개 등 쿠키에 없는 필드가 비어 '초기화된 것처럼' 보이던 문제를 회피.
 */
export async function GET() {
  const pc = cookies().get('marie_profile');
  if (!pc?.value) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  let me: { id?: string } | null = null;
  try { me = JSON.parse(pc.value); } catch { me = null; }
  if (!me?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('contact_name, company_name, business_type, region, bio, phone, website, profile_image')
    .eq('id', me.id)
    .maybeSingle();

  return NextResponse.json({ profile: data ?? null });
}
