import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/features/notifications/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 관리자 일괄 공지 메일 발송 — marie 회원(선택: 전체/업체/개인)에게 이메일 발송.
 * marie_admin_unlock 쿠키로만 허용. Resend 키 미설정 시 email.ts 가 콘솔 폴백.
 * Body: { subject, message, target?: 'all'|'business'|'individual' }
 */
export async function POST(req: Request) {
  if (cookies().get('marie_admin_unlock')?.value !== '1') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { subject, message, target } = await req.json().catch(() => ({}));
  const subj = typeof subject === 'string' ? subject.trim() : '';
  const msg = typeof message === 'string' ? message.trim() : '';
  if (!subj || !msg) return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });

  const supabase = createServiceClient();
  let q = supabase.from('profiles').select('user_id, account_type').is('deleted_at', null).not('user_id', 'is', null);
  if (target === 'business' || target === 'individual') q = q.eq('account_type', target);
  const { data: profs } = await q;
  const userIds = new Set((profs ?? []).map((p) => p.user_id as string));
  if (userIds.size === 0) return NextResponse.json({ ok: true, sent: 0, total: 0 });

  // auth.users 이메일 매핑
  const emails: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) {
      if (userIds.has(u.id) && u.email) emails.push(u.email);
    }
    if (data.users.length < 1000) break;
    page += 1;
    if (page > 20) break; // 안전장치
  }

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="color:#1a2b4a;margin:0 0 16px">${escapeHtml(subj)}</h2>
    <div style="white-space:pre-wrap;line-height:1.7;color:#333;font-size:15px">${escapeHtml(msg)}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>
    <p style="font-size:12px;color:#999;margin:0">마리에(Marié) · 본 메일은 안내 목적으로 발송되었습니다.</p>
  </div>`;

  let sent = 0;
  for (const to of emails) {
    const r = await sendEmail({ to, subject: subj, html, text: msg });
    if (r.ok) sent += 1;
  }
  return NextResponse.json({ ok: true, sent, total: emails.length });
}
