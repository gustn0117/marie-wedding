import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 디렉토리/프로필 업데이트 API (service_role).
 *
 * 배경: 클라이언트 .update().select().maybeSingle() 가
 *  - RLS readback / moderation trigger 영향으로 응답 hang
 *  - 또는 data=null 반환 → UI 무한 '저장 중...'
 * 이 문제를 service_role 우회로 해결.
 *
 * 본인 또는 admin 만 허용.
 */
export async function POST(request: Request) {
  let body: { id?: string; updates?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const { id, updates } = body;
  if (!id || !updates) {
    return NextResponse.json({ error: 'id 및 updates 필수입니다.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: target } = await service
    .from('profiles')
    .select('id, user_id, role')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 본인 또는 admin 인가
  const { data: me } = await service
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  const isOwner = target.user_id === user.id;
  const isAdmin = me?.role === 'admin';
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  // 화이트리스트 — UI 가 보내는 필드만 허용
  const ALLOWED = new Set([
    'contact_name', 'company_name', 'business_type', 'region',
    'bio', 'phone', 'website', 'profile_image',
    'company_size', 'established_year', 'address', 'gallery',
    'is_directory_listed',
  ]);
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(updates)) {
    if (ALLOWED.has(k)) payload[k] = v;
  }

  const { data, error } = await service
    .from('profiles')
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `저장에 실패했습니다: ${error.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    // service_role 로 select 도 안 보이는 케이스는 거의 없음 — but 만일을 대비해
    return NextResponse.json({ success: true, data: null });
  }
  return NextResponse.json({ success: true, data });
}
