import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { getSmsAdapter } from '@/lib/sms/adapter';
import { normalizePhone, isValidPhone, hashOtp, generateOtpCode } from '@/lib/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_TTL_MS = 3 * 60 * 1000; // 3분
const RESEND_COOLDOWN_MS = 30 * 1000; // 30초

/**
 * 휴대폰 인증번호 발송 — 6자리 코드 생성 → 해시 저장(phone_otps) → SMS 발송(NHN 어댑터).
 * SMS 키 미설정 시 어댑터가 콘솔 출력(dev). 로그인 상태면 profile_id 연결.
 */
export async function POST(req: Request) {
  try {
    const { phone } = await req.json().catch(() => ({}));
    const digits = normalizePhone(phone);
    if (!isValidPhone(digits)) {
      return NextResponse.json({ error: '올바른 휴대폰 번호를 입력해주세요.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 재발송 쿨다운(30초)
    const { data: recent } = await supabase
      .from('phone_otps')
      .select('created_at')
      .eq('phone', digits)
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

    const { error: insErr } = await supabase.from('phone_otps').insert({
      profile_id: profileId,
      phone: digits,
      code_hash: hashOtp(digits, code),
      attempts: 0,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    });
    if (insErr) {
      console.error('[otp/send] insert error:', insErr.message);
      return NextResponse.json({ error: '발송에 실패했습니다.' }, { status: 500 });
    }

    try {
      await getSmsAdapter().send(digits, `[마리에] 인증번호 [${code}]\n3분 이내 입력해주세요.`);
    } catch (err) {
      console.error('[otp/send] sms error:', err);
      return NextResponse.json({ error: '인증번호 발송에 실패했습니다.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[otp/send] failed:', err);
    return NextResponse.json({ error: '발송에 실패했습니다.' }, { status: 500 });
  }
}
