import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { hashOtp, generateOtpCode } from '@/lib/otp';
import { removeIssuedOtp } from '@/lib/issuedOtp';
import { validateEmail } from '@/shared/utils/validation';
import { sendEmail } from '@/features/notifications/lib/email';
import { emailOtpEmail } from '@/features/notifications/lib/templates';
import { consumeOtpSendAttempt } from '@/lib/otpVerifyRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_TTL_MS = 3 * 60 * 1000; // 3분
const RESEND_COOLDOWN_MS = 30 * 1000; // 30초
const REQUEST_TIMEOUT_MS = 20_000;
type OtpIssuanceResult = { otp_id: string | null; issuance_status: string };

/**
 * 이메일 인증번호 발송 — 6자리 코드 생성 → 해시 저장(email_otps) → 메일 발송.
 * 휴대폰 OTP 와 동일 패턴. 발송은 자체 SMTP(admin@marie.co.kr).
 */
export async function POST(req: Request) {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  let issuedOtpId: string | null = null;
  try {
    const { email } = await req.json().catch(() => ({}));
    const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const check = validateEmail(addr);
    if (!check.valid) {
      return NextResponse.json({ error: check.reason ?? '올바른 이메일을 입력해주세요.' }, { status: 400 });
    }
    if (!consumeOtpSendAttempt(req, 'email-signup', addr)) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const supabase = createServiceClient(signal);
    const code = generateOtpCode();
    const caller = await getVerifiedProfile(signal);
    const profileId = caller.ok ? caller.profileId : null;

    issuedOtpId = randomUUID();
    const { data: issuanceData, error: issueError } = await supabase
      .rpc('issue_email_otp_atomic', {
        p_otp_id: issuedOtpId,
        p_profile_id: profileId,
        p_email: addr,
        p_purpose: 'signup',
        p_code_hash: hashOtp(addr, code),
        p_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        p_cooldown_seconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
      })
      .abortSignal(signal)
      .maybeSingle();
    if (issueError) throw issueError;
    const issuance = issuanceData as OtpIssuanceResult | null;
    if (issuance?.issuance_status === 'cooldown') {
      issuedOtpId = null;
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요. (30초)' }, { status: 429 });
    }
    if (issuance?.issuance_status !== 'created' || issuance.otp_id !== issuedOtpId) {
      throw new Error(`Unexpected email OTP issuance status: ${issuance?.issuance_status ?? 'empty'}`);
    }

    const { subject, html, text } = emailOtpEmail(code);
    const r = await sendEmail({ to: addr, subject, html, text });
    if (!r.ok) {
      console.error('[email-otp/send] mail error:', r.error);
      await removeIssuedOtp('email_otps', issuedOtpId);
      issuedOtpId = null;
      return NextResponse.json({ error: '인증번호 발송에 실패했습니다.' }, { status: 502 });
    }

    issuedOtpId = null;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (issuedOtpId) await removeIssuedOtp('email_otps', issuedOtpId);
    console.error('[email-otp/send] failed:', err);
    return NextResponse.json(
      { error: signal.aborted ? '발송 요청 시간이 초과되었습니다.' : '발송에 실패했습니다.' },
      { status: signal.aborted ? 504 : 500 },
    );
  }
}
