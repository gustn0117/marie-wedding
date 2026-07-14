import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { hashOtp, generateOtpCode } from '@/lib/otp';
import { validateEmail } from '@/shared/utils/validation';
import { sendEmail } from '@/features/notifications/lib/email';
import { emailOtpEmail } from '@/features/notifications/lib/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_TTL_MS = 3 * 60 * 1000; // 3분
const RESEND_COOLDOWN_MS = 30 * 1000; // 30초

/**
 * 이메일 인증번호 발송 — 6자리 코드 생성 → 해시 저장(email_otps) → 메일 발송.
 * 휴대폰 OTP 와 동일 패턴. 발송은 자체 SMTP(admin@marie.co.kr).
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({}));
    const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const check = validateEmail(addr);
    if (!check.valid) {
      return NextResponse.json({ error: check.reason ?? '올바른 이메일을 입력해주세요.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 재발송 쿨다운(30초)
    const { data: recent } = await supabase
      .from('email_otps')
      .select('created_at')
      .eq('email', addr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요. (30초)' }, { status: 429 });
    }

    const code = generateOtpCode();
    let profileId: string | null = null;
    try {
      const pc = cookies().get('marie_profile');
      if (pc?.value) profileId = JSON.parse(pc.value)?.id ?? null;
    } catch { /* 비로그인 */ }

    const { error: insErr } = await supabase.from('email_otps').insert({
      profile_id: profileId,
      email: addr,
      code_hash: hashOtp(addr, code),
      attempts: 0,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    });
    if (insErr) {
      console.error('[email-otp/send] insert error:', insErr.message);
      return NextResponse.json({ error: '발송에 실패했습니다.' }, { status: 500 });
    }

    const { subject, html, text } = emailOtpEmail(code);
    const r = await sendEmail({ to: addr, subject, html, text });
    if (!r.ok) {
      console.error('[email-otp/send] mail error:', r.error);
      return NextResponse.json({ error: '인증번호 발송에 실패했습니다.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email-otp/send] failed:', err);
    return NextResponse.json({ error: '발송에 실패했습니다.' }, { status: 500 });
  }
}
