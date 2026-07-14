import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { normalizePhone, isValidPhone, hashOtp } from '@/lib/otp';
import { consumeOtpVerifyAttempt } from '@/lib/otpVerifyRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 12_000;
type OtpVerificationResult = { otp_id: string | null; verification_status: string };

/**
 * 휴대폰 인증번호 검증. 성공 시 phone_otps.verified_at 기록.
 * 로그인 상태면 내 프로필의 phone/phone_verified 도 갱신한다.
 * 회원가입 흐름은 이후 signup 이 '최근 verified 된 phone' 을 확인한다.
 */
export async function POST(req: Request) {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  try {
    const { phone, code } = await req.json().catch(() => ({}));
    const digits = normalizePhone(phone);
    const codeStr = typeof code === 'string' ? code.trim() : String(code ?? '');
    if (!isValidPhone(digits) || !/^\d{6}$/.test(codeStr)) {
      return NextResponse.json({ error: '휴대폰 번호와 6자리 인증번호를 확인해주세요.' }, { status: 400 });
    }
    if (!consumeOtpVerifyAttempt(req, 'phone', digits)) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    // OTP를 소비하기 전에 로그인 호출자 신원을 확정한다. 인증 인프라가 잠시 실패한
    // 상태에서 OTP만 verified로 바뀌고 프로필 반영은 영구 누락되는 일을 막는다.
    const caller = await getVerifiedProfile(signal);
    if (!caller.ok && (caller.reason === 'timeout' || caller.reason === 'server_error')) {
      return NextResponse.json(
        { error: caller.reason === 'timeout' ? '인증 서버 응답이 지연되고 있습니다.' : '로그인 정보를 확인하지 못했습니다.' },
        { status: caller.reason === 'timeout' ? 504 : 503 },
      );
    }

    const supabase = createServiceClient(signal);
    const verificationRpc = caller.ok
      ? supabase.rpc('verify_and_bind_profile_phone_otp_atomic', {
        p_profile_id: caller.profileId,
        p_phone: digits,
        p_code_hash: hashOtp(digits, codeStr),
        p_max_attempts: MAX_ATTEMPTS,
      })
      : supabase.rpc('verify_phone_otp_atomic', {
        p_phone: digits,
        p_code_hash: hashOtp(digits, codeStr),
        p_max_attempts: MAX_ATTEMPTS,
      });
    const { data: verificationData, error: verificationError } = await verificationRpc
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
    if (status !== 'verified') throw new Error(`Unexpected phone OTP status: ${status ?? 'empty'}`);

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    console.error('[otp/verify] failed:', err);
    return NextResponse.json(
      { error: signal.aborted ? '인증 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '인증에 실패했습니다.' },
      { status: signal.aborted ? 504 : 500 },
    );
  }
}
