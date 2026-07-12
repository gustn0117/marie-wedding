import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Portfolio create / update API (service_role).
 * QA-010 방지 + moderation trigger 잠재 이슈 사전 봉인.
 */
interface PortfolioPayload {
  title?: string;
  description?: string | null;
  event_date?: string | null;
  role?: string | null;
  venue_name?: string | null;
  cover_image?: string | null;
  images?: string[];
  display_order?: number;
  is_featured?: boolean;
}

export async function POST(request: Request) {
  let body: { mode?: 'create' | 'update'; id?: string; payload?: PortfolioPayload };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const mode = body.mode;
  const payload = body.payload ?? {};
  if (mode !== 'create' && mode !== 'update') {
    return NextResponse.json({ error: 'mode 필수' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    SUPABASE_SERVER_URL,
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
  const { data: me } = await service
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });

  if (mode === 'create') {
    if (!payload.title) return NextResponse.json({ error: '제목 필수' }, { status: 400 });
    const { data, error } = await service.from('portfolios').insert({
      profile_id: me.id,
      title: payload.title,
      description: payload.description ?? null,
      event_date: payload.event_date ?? null,
      role: payload.role ?? null,
      venue_name: payload.venue_name ?? null,
      cover_image: payload.cover_image ?? null,
      images: payload.images ?? [],
      display_order: payload.display_order ?? 0,
      is_featured: !!payload.is_featured,
    }).select('*').single();
    if (error) {
      console.error('[portfolios/write:create] failed:', error);
      return NextResponse.json({ error: `등록에 실패했습니다: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true, portfolio: data });
  }

  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
  const { data: existing } = await service.from('portfolios').select('id, profile_id, deleted_at').eq('id', id).maybeSingle();
  if (!existing) return NextResponse.json({ error: '포트폴리오를 찾을 수 없습니다.' }, { status: 404 });
  if (existing.deleted_at) return NextResponse.json({ error: '이미 삭제된 포트폴리오입니다.' }, { status: 410 });
  if (existing.profile_id !== me.id && me.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.event_date !== undefined) update.event_date = payload.event_date;
  if (payload.role !== undefined) update.role = payload.role;
  if (payload.venue_name !== undefined) update.venue_name = payload.venue_name;
  if (payload.cover_image !== undefined) update.cover_image = payload.cover_image;
  if (payload.images !== undefined) update.images = payload.images;
  if (payload.display_order !== undefined) update.display_order = payload.display_order;
  if (payload.is_featured !== undefined) update.is_featured = payload.is_featured;

  const { data: updated, error: updErr } = await service.from('portfolios').update(update).eq('id', id).select('*').maybeSingle();
  if (updErr) {
    console.error('[portfolios/write:update] failed:', updErr);
    return NextResponse.json({ error: `수정에 실패했습니다: ${updErr.message}` }, { status: 500 });
  }
  return NextResponse.json({ success: true, portfolio: updated });
}
