import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';
import { sendEmail } from '@/features/notifications/lib/email';
import { sanitizeRichHtml, sanitizeEmailHtml } from '@/shared/utils/sanitizeRichHtml';

const APP_URL = 'https://marie.co.kr'; // 추적 픽셀은 외부 수신자가 로드하므로 공개 URL 고정

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE = 50;

function escapeHtml(v: string) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 이메일 본문 컨테이너 — 폭/기본 서체를 인라인으로 고정(메일 클라이언트는 <style> 를 자주 제거).
// 본문 서식(굵기·정렬·이미지 크기)은 에디터가 이미 인라인 스타일로 넣으므로 그대로 살아남는다.
const MAIL_SHELL_OPEN = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:600px;margin:0 auto;line-height:1.7;color:#333;font-size:15px;word-break:break-word">`;
const MAIL_SHELL_CLOSE = `</div>`;

// 관리자 작성 리치 HTML → 허용목록 정리 후 메일 컨테이너로 감싼다.
function richBodyHtml(html: string) {
  const inner = sanitizeRichHtml(html);
  // 스타일이 없는 이미지(예: 붙여넣기)만 넘침 방지 스타일을 부여한다.
  // 에디터가 넣은 이미지는 이미 width/정렬 인라인 스타일이 있으므로 건드리지 않는다.
  // (style 을 중복으로 붙이면 메일 클라이언트가 앞의 것만 적용해 크기/정렬이 깨진다.)
  const guarded = inner.replace(/<img(?![^>]*\bstyle=)/gi, '<img style="max-width:100%;height:auto"');
  return `${MAIL_SHELL_OPEN}${guarded}${MAIL_SHELL_CLOSE}`;
}

// 관리자 답장/작성 본문(plain text)을 안전한 HTML 로 감싼다.
function bodyHtml(text: string) {
  return `${MAIL_SHELL_OPEN}<div style="white-space:pre-wrap">${escapeHtml(text)}</div>${MAIL_SHELL_CLOSE}`;
}

// HTML → 대체 텍스트(멀티파트 text/plain + 목록 미리보기/답장 인용용).
function htmlToText(html: string): string {
  return html
    // style/script 블록은 내용까지 통째로 제거(태그만 지우면 CSS 가 본문 텍스트로 샌다)
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*(br|\/p|\/div|\/h2|\/h3|\/h1|\/h4|\/h5|\/h6|\/li|\/tr|\/table)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// ── 목록 ──────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);

  // 이미 보낸 수신자 맵 — 작성 시 중복 발송 경고용. 최근 발송분 집계(소문자 키).
  if (url.searchParams.get('recipients') === '1') {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('admin_mail')
      .select('to_addr, created_at')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(5000);
    const recipients: Record<string, { at: string; count: number }> = {};
    for (const row of data ?? []) {
      const addr = (row.to_addr || '').replace(/^.*<([^>]+)>.*$/, '$1').trim().toLowerCase();
      if (!addr) continue;
      if (recipients[addr]) recipients[addr].count += 1;
      // created_at desc 로 정렬돼 있어 첫 등장이 최신
      else recipients[addr] = { at: row.created_at, count: 1 };
    }
    return NextResponse.json({ recipients });
  }

  const folder = url.searchParams.get('folder') === 'outbound' ? 'outbound' : 'inbound';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const from = (page - 1) * PAGE;
  // 검색어 — 보낸사람/받는사람/제목/본문 부분일치. PostgREST or() 구문을 깨는 문자는 제거.
  const q = (url.searchParams.get('q') || '').replace(/[,()%_\\]/g, ' ').trim().slice(0, 100);

  const supabase = createServiceClient();
  let query = supabase
    .from('admin_mail')
    .select('id, direction, from_addr, to_addr, subject, body_text, body_html, message_id, in_reply_to, read_at, opened_at, open_count, created_at', { count: 'exact' })
    .eq('direction', folder);
  if (q) {
    query = query.or(`from_addr.ilike.%${q}%,to_addr.ilike.%${q}%,subject.ilike.%${q}%,body_text.ilike.%${q}%`);
  }
  const { data, count, error } = await query
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

  // 보낸 메일 전달 상태 — 최신 열람(수신확인) + 반송(전달 실패) 감지.
  // 반송: 발송 이후 받은편지함에서 이 메일을 참조하는 실패 통지(mailer-daemon/postmaster,
  // 제목에 deliver/failure/반송 등)를 찾아, 본문이 우리 Message-ID 나 수신자 주소를 담으면 매칭.
  if (action === 'status') {
    const id = typeof body.id === 'string' ? body.id : null;
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const { data: mail } = await supabase
      .from('admin_mail')
      .select('id, direction, to_addr, message_id, opened_at, open_count, created_at')
      .eq('id', id)
      .maybeSingle();
    if (!mail || mail.direction !== 'outbound') {
      return NextResponse.json({ error: '보낸 메일을 찾을 수 없습니다.' }, { status: 404 });
    }

    const recipient = (mail.to_addr || '').replace(/^.*<([^>]+)>.*$/, '$1').trim().toLowerCase();
    const innerMid = (mail.message_id || '').replace(/^<|>$/g, '').trim();
    let bounce: { at: string; from: string; subject: string | null; snippet: string } | null = null;

    const { data: candidates } = await supabase
      .from('admin_mail')
      .select('id, from_addr, subject, body_text, created_at')
      .eq('direction', 'inbound')
      .gte('created_at', mail.created_at)
      .or('from_addr.ilike.%mailer-daemon%,from_addr.ilike.%postmaster%,subject.ilike.%deliver%,subject.ilike.%failure%,subject.ilike.%반송%,subject.ilike.%실패%,subject.ilike.%returned%,subject.ilike.%undeliverable%')
      .order('created_at', { ascending: true })
      .limit(30);

    for (const c of candidates ?? []) {
      const bt = (c.body_text || '').toLowerCase();
      const refsMid = innerMid.length > 0 && bt.includes(innerMid.toLowerCase());
      const refsRcpt = recipient.length > 0 && bt.includes(recipient);
      // 시스템 발신(메일 배달 시스템)만 반송으로 인정 — 사람이 보낸 답장의 오탐 방지.
      const fromSystem = /mailer-daemon|postmaster|mail delivery|delivery sub|delivery system/i.test(c.from_addr || '');
      // Message-ID 일치는 강한 증거. 수신자 주소만 일치할 땐 시스템 발신일 때만 반송으로 본다.
      if (refsMid || (refsRcpt && fromSystem)) {
        bounce = {
          at: c.created_at,
          from: c.from_addr,
          subject: c.subject,
          snippet: (c.body_text || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        };
        break;
      }
    }

    return NextResponse.json({ ok: true, opened_at: mail.opened_at, open_count: mail.open_count ?? 0, bounce });
  }

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
    // mode: 'html' = 완성된 HTML 소스 직접 발송, 그 외 = 리치 에디터 산출물.
    const mode = body.mode === 'html' ? 'html' : 'rich';
    const rawHtml = typeof body.html === 'string' ? body.html : '';
    const rawText = typeof body.text === 'string' ? body.text : '';
    const inReplyTo = typeof body.inReplyTo === 'string' ? body.inReplyTo : null;
    if (!EMAIL_RE.test(to)) return NextResponse.json({ error: '받는사람 이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 });

    // 본문 HTML/텍스트/텍스트대체 확정
    let cleanHtml: string;
    let textPart: string;
    if (mode === 'html') {
      // 소스 모드 — 넓은 이메일 허용목록으로 정리, 템플릿 레이아웃을 살리기 위해 감싸지 않는다.
      if (!rawHtml.trim()) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
      cleanHtml = sanitizeEmailHtml(rawHtml);
      textPart = htmlToText(cleanHtml);
      if (!textPart && !/<img\b/i.test(cleanHtml)) {
        return NextResponse.json({ error: '내용이 비어 있습니다. HTML 본문을 확인해주세요.' }, { status: 400 });
      }
    } else if (rawHtml.trim()) {
      cleanHtml = richBodyHtml(rawHtml);
      textPart = htmlToText(cleanHtml);
      // 시각적으로 비어도(예: <p><br></p>) 이미지가 있으면 발송 허용
      if (!textPart && !/<img\b/i.test(cleanHtml)) {
        return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
      }
    } else {
      if (!rawText.trim()) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
      cleanHtml = bodyHtml(rawText);
      textPart = rawText;
    }

    // 수신확인(오픈 트래킹) — 보내는 메일에만 보이지 않는 추적 픽셀을 심는다. 상대가 열어
    // 이미지를 로드하면 /api/mail/track/{id} 가 opened_at 을 기록. 저장본(body_html)에는
    // 픽셀을 넣지 않아 관리자 본인이 보낸편지함을 열 때 오탐(읽음)이 나지 않게 한다.
    const trackingId = randomUUID();
    const pixel = `<img src="${APP_URL}/api/mail/track/${trackingId}" width="1" height="1" alt="" style="display:none;max-height:0;overflow:hidden"/>`;

    const result = await sendEmail({ to, subject, html: cleanHtml + pixel, text: textPart });
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
      body_text: textPart.slice(0, 500_000),
      body_html: cleanHtml.slice(0, 500_000),
      message_id: result.id ?? null,
      in_reply_to: inReplyTo?.slice(0, 998) ?? null,
      read_at: new Date().toISOString(), // 보낸메일은 (관리자에게) 읽음 상태
    });

    return NextResponse.json({ ok: true, id: result.id });
  }

  return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 });
}
