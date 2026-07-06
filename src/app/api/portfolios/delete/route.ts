import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { id?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });

  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const service = createServiceClient();
  const [{ data: me }, { data: portfolio }] = await Promise.all([
    service.from('profiles').select('id, role').eq('user_id', user.id).maybeSingle(),
    service.from('portfolios').select('id, profile_id, deleted_at').eq('id', id).maybeSingle(),
  ]);
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (!portfolio) return NextResponse.json({ error: '포트폴리오를 찾을 수 없습니다.' }, { status: 404 });
  if (portfolio.deleted_at) return NextResponse.json({ error: '이미 삭제됨' }, { status: 410 });
  if (portfolio.profile_id !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { error } = await service.from('portfolios').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: `삭제에 실패했습니다: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
