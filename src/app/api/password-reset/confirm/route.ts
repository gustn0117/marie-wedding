import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hashOtp } from '@/lib/otp';
import { consumeOtpVerifyAttempt } from '@/lib/otpVerifyRateLimit';
import { validateEmail } from '@/shared/utils/validation';
import { findAuthUserByEmail } from '@/lib/authUsers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 12_000;

type ResetClaim = { otpId: string; token: string };
type ResetClaimResult = { otp_id: string | null; verification_status: string };

async function releaseResetClaim(claim: ResetClaim) {
  const cleanupSignal = AbortSignal.timeout(3_000);
  try {
    const cleanupClient = createServiceClient(cleanupSignal);
    const { error } = await cleanupClient
      .rpc('release_password_reset_otp_claim', {
        p_otp_id: claim.otpId,
        p_claim_token: claim.token,
      })
      .abortSignal(cleanupSignal);
    if (error) console.error('[password-reset/confirm] claim release error:', error.message);
  } catch (error) {
    console.error('[password-reset/confirm] claim release failed:', error);
  }
}

async function completeResetClaim(claim: ResetClaim): Promise<boolean> {
  // Auth 변경 응답 뒤 기존 요청 deadline이 끝났을 수 있다. 같은 token의 완료는
  // idempotent하므로 독립 deadline으로 재시도한다.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completionSignal = AbortSignal.timeout(5_000);
    try {
      const client = createServiceClient(completionSignal);
      const { data, error } = await client
        .rpc('complete_password_reset_otp_atomic', {
          p_otp_id: claim.otpId,
          p_claim_token: claim.token,
        })
        .abortSignal(completionSignal);
      if (!error) return data === true;
      console.error('[password-reset/confirm] consume error:', error.message);
    } catch (error) {
      console.error('[password-reset/confirm] consume request failed:', error);
    }
  }
  return false;
}

/**
 * 비밀번호 재설정 확정 — 인증번호 검증 후 service_role 로 비밀번호 변경.
 * Body: { email, code, password }
 */
export async function POST(req: Request) {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  let activeClaim: ResetClaim | null = null;
  let authUpdateStarted = false;
  try {
    const { email, code, password } = await req.json().catch(() => ({}));
    const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const codeStr = typeof code === 'string' ? code.trim() : String(code ?? '');
    const pw = typeof password === 'string' ? password : '';

    if (!validateEmail(addr).valid || !/^\d{6}$/.test(codeStr)) {
      return NextResponse.json({ error: '이메일과 6자리 인증번호를 확인해주세요.' }, { status: 400 });
    }
    if (pw.length < 6) {
      return NextResponse.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, { status: 400 });
    }
    if (!consumeOtpVerifyAttempt(req, 'password-reset', addr)) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const supabase = createServiceClient(signal);
    const claimToken = randomUUID();
    const { data: claimData, error: claimError } = await supabase
      .rpc('claim_password_reset_otp_atomic', {
        p_email: addr,
        p_code_hash: hashOtp(addr, codeStr),
        p_max_attempts: MAX_ATTEMPTS,
        p_claim_token: claimToken,
      })
      .abortSignal(signal)
      .maybeSingle();

    if (claimError) throw claimError;
    const claimResult = claimData as ResetClaimResult | null;
    const status = claimResult?.verification_status;
    if (!claimResult || status === 'not_found') {
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
    if (status === 'consumed') {
      return NextResponse.json({ error: '인증번호를 다시 요청해주세요.' }, { status: 400 });
    }
    if (status === 'in_progress') {
      return NextResponse.json({ error: '비밀번호 변경을 처리 중입니다. 잠시 후 다시 시도해주세요.' }, { status: 409 });
    }
    if (status !== 'claimed' || !claimResult.otp_id) {
      throw new Error(`Unexpected password reset OTP status: ${status ?? 'empty'}`);
    }
    activeClaim = { otpId: claimResult.otp_id, token: claimToken };

    const user = await findAuthUserByEmail(addr, signal);
    if (!user) {
      await releaseResetClaim(activeClaim);
      activeClaim = null;
      if (signal.aborted) throw new Error('Password reset user lookup timed out');
      return NextResponse.json({ error: '가입 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    // 이 시점 이후 네트워크 오류는 Auth 서버가 실제 변경을 적용한 뒤 응답만
    // 유실된 것일 수 있다. 따라서 같은 OTP claim을 다시 release하지 않는다.
    authUpdateStarted = true;
    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password: pw });
    if (updErr) {
      console.error('[password-reset/confirm] update error:', updErr.message);
      if (signal.aborted) throw new Error('Password reset Auth update timed out');
      return NextResponse.json({ error: '비밀번호 변경에 실패했습니다. 새 인증번호로 다시 시도해주세요.' }, { status: 500 });
    }

    // 외부 Auth 변경이 성공한 뒤 소비를 독립 deadline으로 확정한다. 결과가 끝내
    // 불명이어도 claim은 OTP 만료까지 유지되므로 같은 코드 재사용은 불가능하다.
    const completed = await completeResetClaim(activeClaim);
    if (!completed) {
      console.error('[password-reset/confirm] password updated but OTP completion is uncertain');
      activeClaim = null;
      return NextResponse.json({ ok: true, completionPending: true });
    }
    activeClaim = null;

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (activeClaim && !authUpdateStarted) await releaseResetClaim(activeClaim);
    console.error('[password-reset/confirm] failed:', err);
    return NextResponse.json(
      { error: signal.aborted ? '비밀번호 변경 요청 시간이 초과되었습니다. 다시 시도해주세요.' : '비밀번호 변경에 실패했습니다.' },
      { status: signal.aborted ? 504 : 500 },
    );
  }
}
