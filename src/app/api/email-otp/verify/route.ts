import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hashOtp } from '@/lib/otp';
import { consumeOtpVerifyAttempt } from '@/lib/otpVerifyRateLimit';
import { validateEmail } from '@/shared/utils/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 12_000;
type OtpVerificationResult = { otp_id: string | null; verification_status: string };

/**
 * 이메일 인증번호 검증. 성공 시 email_otps.verified_at 기록.
 * 회원가입 route 가 '최근 verified 된 email' 을 확인한다(30분 창).
 */
export async function POST(req: Request) {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  try {
    const { email, code } = await req.json().catch(() => ({}));
    const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const codeStr = typeof code === 'string' ? code.trim() : String(code ?? '');
    if (!validateEmail(addr).valid || !/^\d{6}$/.test(codeStr)) {
      return NextResponse.json({ error: '이메일과 6자리 인증번호를 확인해주세요.' }, { status: 400 });
    }
    if (!consumeOtpVerifyAttempt(req, 'email-signup', addr)) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const supabase = createServiceClient(signal);
    const { data: verificationData, error: verificationError } = await supabase
      .rpc('verify_email_otp_atomic', {
        p_email: addr,
        p_purpose: 'signup',
        p_code_hash: hashOtp(addr, codeStr),
        p_max_attempts: MAX_ATTEMPTS,
      })
      .abortSignal(signal)
      .maybeSingle();

    if (verificationError) throw verificationError;
    const verification = verificationData as OtpVerificationResult | null;
    const status = verification?.verification_status;
    if (!verification || status === 'not_found') {
      return NextResponse.json({ error: '인증번호를 다시 요청해주세요.' }, { status: 400 });
    }
    if (status === 'expired') {
      return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 });
    }
    if (status === 'attempts_exceeded') {
      return NextResponse.json({ error: '시도 횟수를 초과했습니다. 다시 요청해주세요.' }, { status: 429 });
    }
    if (status === 'mismatch') {
      return NextResponse.json({ error: '인증번호가 일치하지 않습니다.' }, { status: 400 });
    }
    if (status !== 'verified') throw new Error(`Unexpected email OTP status: ${status ?? 'empty'}`);

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    console.error('[email-otp/verify] failed:', err);
    return NextResponse.json(
      { error: signal.aborted ? '인증 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '인증에 실패했습니다.' },
      { status: signal.aborted ? 504 : 500 },
    );
  }
}
