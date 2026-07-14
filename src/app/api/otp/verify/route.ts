import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizePhone, isValidPhone, hashOtp } from '@/lib/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;

/**
 * 휴대폰 인증번호 검증. 성공 시 phone_otps.verified_at 기록.
 * 로그인 상태면 내 프로필의 phone/phone_verified 도 갱신한다.
 * 회원가입 흐름은 이후 signup 이 '최근 verified 된 phone' 을 확인한다.
 */
export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json().catch(() => ({}));
    const digits = normalizePhone(phone);
    const codeStr = typeof code === 'string' ? code.trim() : String(code ?? '');
    if (!isValidPhone(digits) || !/^\d{6}$/.test(codeStr)) {
      return NextResponse.json({ error: '휴대폰 번호와 6자리 인증번호를 확인해주세요.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: otp } = await supabase
      .from('phone_otps')
      .select('id, code_hash, attempts, expires_at')
      .eq('phone', digits)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) return NextResponse.json({ error: '인증번호를 다시 요청해주세요.' }, { status: 400 });
    if (new Date(otp.expires_at) < new Date()) {
      return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 });
    }
    if ((otp.attempts ?? 0) >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: '시도 횟수를 초과했습니다. 다시 요청해주세요.' }, { status: 429 });
    }
    if (hashOtp(digits, codeStr) !== otp.code_hash) {
      await supabase.from('phone_otps').update({ attempts: (otp.attempts ?? 0) + 1 }).eq('id', otp.id);
      return NextResponse.json({ error: '인증번호가 일치하지 않습니다.' }, { status: 400 });
    }

    await supabase.from('phone_otps').update({ verified_at: new Date().toISOString() }).eq('id', otp.id);

    // 로그인 상태면 내 프로필에 즉시 반영
    try {
      const pc = cookies().get('marie_profile');
      const meId = pc?.value ? JSON.parse(pc.value)?.id : null;
      if (meId) {
        await supabase.from('profiles').update({ phone: digits, phone_verified: true }).eq('id', meId);
      }
    } catch { /* 비로그인 흐름 */ }

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    console.error('[otp/verify] failed:', err);
    return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 500 });
  }
}
