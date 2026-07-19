import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';
import { sendEmail } from '@/features/notifications/lib/email';

const APP_URL = 'https://marie.co.kr'; // 추적 픽셀은 외부 수신자가 로드하므로 공개 URL 고정

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE = 50;

function escapeHtml(v: string) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 관리자 답장/작성 본문(plain text)을 안전한 HTML 로 감싼다.
function bodyHtml(text: string) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;line-height:1.7;color:#333;font-size:15px;white-space:pre-wrap">${escapeHtml(text)}</div>`;
}

// ── 목록 ──────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const folder = url.searchParams.get('folder') === 'outbound' ? 'outbound' : 'inbound';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const from = (page - 1) * PAGE;

  const supabase = createServiceClient();
  const { data, count, error } = await supabase
    .from('admin_mail')
    .select('id, direction, from_addr, to_addr, subject, body_text, body_html, message_id, in_reply_to, read_at, opened_at, open_count, created_at', { count: 'exact' })
    .eq('direction', folder)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE - 1);

  if (error) {
    console.error('[api/admin/mail] list failed:', error);
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 });
  }

  // 받은편지함 안읽음 수(배지용)
  let unread = 0;
  if (folder === 'inbound') {
    const { count: uc } = await supabase
      .from('admin_mail')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .is('read_at', null);
    unread = uc ?? 0;
  }

  return NextResponse.json({ items: data ?? [], count: count ?? 0, page, pageSize: PAGE, unread });
}

// ── 액션(발송/읽음/삭제) ─────────────────────────────────────────────
export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const action = body.action;
  const supabase = createServiceClient();

  if (action === 'read') {
    const id = typeof body.id === 'string' ? body.id : null;
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    await supabase.from('admin_mail').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const id = typeof body.id === 'string' ? body.id : null;
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const { error } = await supabase.from('admin_mail').delete().eq('id', id);
    if (error) return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'send') {
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const text = typeof body.text === 'string' ? body.text : '';
    const inReplyTo = typeof body.inReplyTo === 'string' ? body.inReplyTo : null;
    if (!EMAIL_RE.test(to)) return NextResponse.json({ error: '받는사람 이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 });
    if (!text.trim()) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });

    // 수신확인(오픈 트래킹) — 보내는 메일에만 보이지 않는 추적 픽셀을 심는다. 상대가 열어
    // 이미지를 로드하면 /api/mail/track/{id} 가 opened_at 을 기록. 저장본(body_html)에는
    // 픽셀을 넣지 않아 관리자 본인이 보낸편지함을 열 때 오탐(읽음)이 나지 않게 한다.
    const trackingId = randomUUID();
    const cleanHtml = bodyHtml(text);
    const pixel = `<img src="${APP_URL}/api/mail/track/${trackingId}" width="1" height="1" alt="" style="display:none;max-height:0;overflow:hidden"/>`;

    const result = await sendEmail({ to, subject, html: cleanHtml + pixel, text });
    if (!result.ok) {
      console.error('[api/admin/mail] send failed:', result.error);
      return NextResponse.json({ error: `발송 실패: ${result.error ?? '알 수 없는 오류'}` }, { status: 502 });
    }

    // 보낸편지함 사본 저장 (id 를 추적 토큰으로 사용, body_html 은 픽셀 제외)
    await supabase.from('admin_mail').insert({
      id: trackingId,
      direction: 'outbound',
      from_addr: process.env.MAIL_FROM || 'admin@marie.co.kr',
      to_addr: to.slice(0, 512),
      subject: subject.slice(0, 998),
      body_text: text.slice(0, 500_000),
      body_html: cleanHtml.slice(0, 500_000),
      message_id: result.id ?? null,
      in_reply_to: inReplyTo?.slice(0, 998) ?? null,
      read_at: new Date().toISOString(), // 보낸메일은 (관리자에게) 읽음 상태
    });

    return NextResponse.json({ ok: true, id: result.id });
  }

  return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 });
}
