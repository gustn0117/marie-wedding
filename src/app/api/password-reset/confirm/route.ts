import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hashOtp } from '@/lib/otp';
import { validateEmail } from '@/shared/utils/validation';
import { findAuthUserByEmail } from '@/lib/authUsers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;

/**
 * 비밀번호 재설정 확정 — 인증번호 검증 후 service_role 로 비밀번호 변경.
 * Body: { email, code, password }
 */
export async function POST(req: Request) {
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

    const supabase = createServiceClient();
    const { data: otp } = await supabase
      .from('email_otps')
      .select('id, code_hash, attempts, expires_at')
      .eq('email', addr)
      .eq('purpose', 'reset')
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

    const user = await findAuthUserByEmail(addr);
    if (!user) return NextResponse.json({ error: '가입 정보를 찾을 수 없습니다.' }, { status: 400 });

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password: pw });
    if (updErr) {
      console.error('[password-reset/confirm] update error:', updErr.message);
      return NextResponse.json({ error: '비밀번호 변경에 실패했습니다.' }, { status: 500 });
    }

    // 사용한 인증번호 정리
    await supabase.from('email_otps').update({ verified_at: new Date().toISOString() }).eq('id', otp.id);
    await supabase.from('email_otps').delete().eq('email', addr).eq('purpose', 'reset').then(undefined, () => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[password-reset/confirm] failed:', err);
    return NextResponse.json({ error: '비밀번호 변경에 실패했습니다.' }, { status: 500 });
  }
}
