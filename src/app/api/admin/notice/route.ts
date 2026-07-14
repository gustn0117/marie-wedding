import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';
import { isUuid } from '@/shared/utils/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const REQUEST_TIMEOUT_MS = 10_000;

/** 공지글 목록 (최신순) */
export async function GET() {
  if (!await hasValidAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, created_at')
    .eq('is_notice', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notices: data ?? [] });
}

/**
 * 공지글 등록 — is_notice=true, author_id=null(마리에 운영팀) 게시글 생성.
 * category 는 DB NOT NULL 호환 위해 'free' 고정.
 * Body: { id: UUID, title, content }  (content 는 HTML)
 */
export async function POST(req: Request) {
  if (!await hasValidAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, title, content } = await req.json().catch(() => ({}));
  const noticeId = typeof id === 'string' ? id.trim() : '';
  const t = typeof title === 'string' ? title.trim() : '';
  const c = typeof content === 'string' ? content.trim() : '';
  if (!t || !c) return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
  if (!isUuid(noticeId)) return NextResponse.json({ error: '유효한 생성 ID가 필요합니다.' }, { status: 400 });

  const supabase = createServiceClient();
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const createInput = {
    id: noticeId,
    title: t,
    content: c,
    category: 'free',
    is_notice: true,
    author_id: null,
  };
  const { data, error } = await supabase
    .from('posts')
    .insert(createInput)
    .select('id, title, created_at, deleted_at')
    .abortSignal(signal)
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: replayError } = await supabase
        .from('posts')
        .select('id, title, content, category, created_at, is_notice, author_id, deleted_at')
        .eq('id', noticeId)
        .abortSignal(signal)
        .maybeSingle();
      if (replayError) {
        return NextResponse.json(
          { error: signal.aborted ? '공지 저장 서버 응답이 지연되고 있습니다.' : replayError.message },
          { status: signal.aborted ? 504 : 500 },
        );
      }
      const sameContext = !!existing
        && existing.is_notice === createInput.is_notice
        && existing.author_id === createInput.author_id
        && !existing.deleted_at;
      const exactReplay = sameContext
        && existing.title === createInput.title
        && existing.content === createInput.content
        && existing.category === createInput.category;
      if (exactReplay) {
        const notice = { id: existing.id, title: existing.title, created_at: existing.created_at };
        return NextResponse.json({ ok: true, id: existing.id, notice, replayed: true });
      }
      if (sameContext) {
        return NextResponse.json({
          error: '같은 생성 ID로 이미 다른 내용의 공지글이 등록되었습니다. 기존에 생성된 공지글을 확인한 뒤 해당 항목을 수정해주세요.',
        }, { status: 409 });
      }
      return NextResponse.json({ error: '이미 사용된 생성 ID입니다.' }, { status: 409 });
    }
    return NextResponse.json(
      { error: signal.aborted ? '공지 저장 서버 응답이 지연되고 있습니다.' : error.message },
      { status: signal.aborted ? 504 : 500 },
    );
  }
  if (data.deleted_at) {
    // 새 migration 적용 전 환경에서도 관리 공지가 금칙어 자동 숨김으로 성공 직후
    // 사라지지 않도록 service-role 관리 경로에서 즉시 복구한다.
    const { error: restoreError } = await supabase
      .from('posts')
      .update({ deleted_at: null })
      .eq('id', data.id)
      .eq('is_notice', true)
      .abortSignal(signal);
    if (restoreError) {
      return NextResponse.json({ error: '공지글이 저장됐지만 공개 상태로 전환하지 못했습니다.' }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, id: data.id, notice: data });
}

/** 공지글 삭제 (soft delete). Body: { id } */
export async function DELETE(req: Request) {
  if (!await hasValidAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_notice', true)
    .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
