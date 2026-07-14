import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hashOtp, generateOtpCode } from '@/lib/otp';
import { validateEmail } from '@/shared/utils/validation';
import { findAuthUserByEmail } from '@/lib/authUsers';
import { sendEmail } from '@/features/notifications/lib/email';
import { passwordResetEmail } from '@/features/notifications/lib/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_TTL_MS = 3 * 60 * 1000; // 3분
const RESEND_COOLDOWN_MS = 30 * 1000; // 30초

/**
 * 비밀번호 재설정 인증번호 발송 — 자체 SMTP(admin@marie.co.kr).
 * 가입된 사용자에게만 실제 발송하되, 계정 존재 여부는 응답으로 노출하지 않는다.
 * Body: { email }
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({}));
    const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!validateEmail(addr).valid) {
      return NextResponse.json({ error: '올바른 이메일을 입력해주세요.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 재발송 쿨다운(30초)
    const { data: recent } = await supabase
      .from('email_otps')
      .select('created_at')
      .eq('email', addr)
      .eq('purpose', 'reset')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요. (30초)' }, { status: 429 });
    }

    // 가입 사용자 확인 — 없으면 조용히 성공 응답(계정 열거 방지)
    const user = await findAuthUserByEmail(addr);
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const code = generateOtpCode();
    const { error: insErr } = await supabase.from('email_otps').insert({
      email: addr,
      code_hash: hashOtp(addr, code),
      purpose: 'reset',
      attempts: 0,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    });
    if (insErr) {
      console.error('[password-reset/send] insert error:', insErr.message);
      return NextResponse.json({ error: '발송에 실패했습니다.' }, { status: 500 });
    }

    const { subject, html, text } = passwordResetEmail(code);
    const r = await sendEmail({ to: addr, subject, html, text });
    if (!r.ok) {
      console.error('[password-reset/send] mail error:', r.error);
      return NextResponse.json({ error: '인증번호 발송에 실패했습니다.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[password-reset/send] failed:', err);
    return NextResponse.json({ error: '발송에 실패했습니다.' }, { status: 500 });
  }
}
