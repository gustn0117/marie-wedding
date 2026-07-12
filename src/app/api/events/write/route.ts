import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Event CRUD API (service_role). 관리자 전용.
 */
interface EventPayload {
  title?: string;
  content?: string;
  type?: string;
  image?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  link_url?: string | null;
  is_pinned?: boolean;
}

export async function POST(request: Request) {
  let body: { mode?: 'create' | 'update' | 'delete'; id?: string; payload?: EventPayload };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  const mode = body.mode;
  if (!mode) return NextResponse.json({ error: 'mode 필수' }, { status: 400 });

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
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  if (mode === 'create') {
    const p = body.payload ?? {};
    if (!p.title || !p.content || !p.type) {
      return NextResponse.json({ error: '제목·내용·유형 필수' }, { status: 400 });
    }
    const { data, error } = await service.from('events').insert({
      title: p.title,
      content: p.content,
      type: p.type,
      image: p.image ?? null,
      start_date: p.start_date ?? null,
      end_date: p.end_date ?? null,
      location: p.location ?? null,
      link_url: p.link_url ?? null,
      is_pinned: !!p.is_pinned,
    }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, event: data });
  }

  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });

  if (mode === 'delete') {
    const { error } = await service.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // update
  const p = body.payload ?? {};
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.title !== undefined) payload.title = p.title;
  if (p.content !== undefined) payload.content = p.content;
  if (p.type !== undefined) payload.type = p.type;
  if (p.image !== undefined) payload.image = p.image;
  if (p.start_date !== undefined) payload.start_date = p.start_date;
  if (p.end_date !== undefined) payload.end_date = p.end_date;
  if (p.location !== undefined) payload.location = p.location;
  if (p.link_url !== undefined) payload.link_url = p.link_url;
  if (p.is_pinned !== undefined) payload.is_pinned = p.is_pinned;

  const { data, error } = await service.from('events').update(payload).eq('id', id).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, event: data });
}
