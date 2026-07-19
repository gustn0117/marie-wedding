import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { timingSafeEqual, createHash } from 'node:crypto';
import PostalMime from 'postal-mime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 수신 메일 엔드포인트 — Cloudflare Email Routing 의 Email Worker 가 admin@marie.co.kr 로 온
 * 메일 '원본(rfc822)' 을 이 곳으로 POST 한다. 파싱은 여기서(postal-mime) 한다.
 * → Worker 는 의존성 없이 대시보드에 붙여넣기만 하면 된다.
 *
 * 인증: 공유 secret(MAIL_INBOUND_SECRET) 을 x-mail-secret 헤더로.
 * 봉투 주소는 x-env-from / x-env-to 헤더로 보조 전달(파싱 실패 폴백).
 */

function secretOk(header: string | null): boolean {
  const expected = process.env.MAIL_INBOUND_SECRET;
  if (!expected || !header) return false;
  const a = createHash('sha256').update(header).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

const MAX = 500_000;
const cut = (v: string | null | undefined, n = MAX) => (typeof v === 'string' ? v.slice(0, n) : null);
function addr(a?: { name?: string; address?: string } | null): string {
  if (!a?.address) return '';
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

export async function POST(request: Request) {
  if (!secretOk(request.headers.get('x-mail-secret'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await request.text();
  if (!raw) return NextResponse.json({ error: 'empty' }, { status: 400 });

  let from = request.headers.get('x-env-from') || '';
  let to = request.headers.get('x-env-to') || '';
  let subject: string | null = null;
  let text: string | null = null;
  let html: string | null = null;
  let messageId: string | null = null;
  let inReplyTo: string | null = null;

  try {
    const email = await PostalMime.parse(raw);
    from = addr(email.from) || from;
    to = (email.to?.map(addr).filter(Boolean).join(', ')) || to;
    subject = cut(email.subject, 998);
    text = cut(email.text);
    html = cut(email.html);
    messageId = cut(email.messageId, 998);
    inReplyTo = cut(email.inReplyTo, 998);
  } catch (e) {
    // 파싱 실패해도 봉투주소 + 원본을 텍스트로 저장(수신 유실 방지).
    console.error('[api/mail/inbound] parse failed, storing raw:', e);
    text = cut(raw);
  }

  if (!from) from = '(알 수 없음)';
  if (!to) to = 'admin@marie.co.kr';

  const supabase = createServiceClient();
  const { error } = await supabase.from('admin_mail').insert({
    direction: 'inbound',
    from_addr: from.slice(0, 512),
    to_addr: to.slice(0, 512),
    subject,
    body_text: text,
    body_html: html,
    message_id: messageId,
    in_reply_to: inReplyTo,
  });

  if (error) {
    console.error('[api/mail/inbound] insert failed:', error);
    return NextResponse.json({ error: 'store failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
