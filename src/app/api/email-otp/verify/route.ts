import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hashOtp } from '@/lib/otp';
import { validateEmail } from '@/shared/utils/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;

/**
 * 이메일 인증번호 검증. 성공 시 email_otps.verified_at 기록.
 * 회원가입 route 가 '최근 verified 된 email' 을 확인한다(30분 창).
 */
export async function POST(req: Request) {
  try {
    const { email, code } = await req.json().catch(() => ({}));
    const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const codeStr = typeof code === 'string' ? code.trim() : String(code ?? '');
    if (!validateEmail(addr).valid || !/^\d{6}$/.test(codeStr)) {
      return NextResponse.json({ error: '이메일과 6자리 인증번호를 확인해주세요.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: otp } = await supabase
      .from('email_otps')
      .select('id, code_hash, attempts, expires_at')
      .eq('email', addr)
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
    if (hashOtp(addr, codeStr) !== otp.code_hash) {
      await supabase.from('email_otps').update({ attempts: (otp.attempts ?? 0) + 1 }).eq('id', otp.id);
      return NextResponse.json({ error: '인증번호가 일치하지 않습니다.' }, { status: 400 });
    }

    await supabase.from('email_otps').update({ verified_at: new Date().toISOString() }).eq('id', otp.id);
    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    console.error('[email-otp/verify] failed:', err);
    return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 500 });
  }
}
