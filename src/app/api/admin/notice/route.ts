import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAdmin() {
  return cookies().get('marie_admin_unlock')?.value === '1';
}

/** 공지글 목록 (최신순) */
export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, created_at')
    .eq('is_notice', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notices: data ?? [] });
}

/**
 * 공지글 등록 — is_notice=true, author_id=null(마리에 운영팀) 게시글 생성.
 * category 는 DB NOT NULL 호환 위해 'free' 고정.
 * Body: { title, content }  (content 는 HTML)
 */
export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { title, content } = await req.json().catch(() => ({}));
  const t = typeof title === 'string' ? title.trim() : '';
  const c = typeof content === 'string' ? content.trim() : '';
  if (!t || !c) return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('posts')
    .insert({ title: t, content: c, category: 'free', is_notice: true, author_id: null })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

/** 공지글 삭제 (soft delete). Body: { id } */
export async function DELETE(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_notice', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
