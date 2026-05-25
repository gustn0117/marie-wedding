import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;

function hashCode(code: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return new NextResponse('unauthorized', { status: 401 });
  const accessToken = auth.slice('Bearer '.length);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const salt = process.env.OTP_HASH_SALT || 'marie-default-salt-change-me';

  const userSb = createSbClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return new NextResponse('unauthorized', { status: 401 });

  const body = await req.json().catch(() => null) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code || !/^[0-9]{6}$/.test(code)) {
    return new NextResponse('6자리 인증번호를 입력해 주세요.', { status: 400 });
  }

  const adminSb = createServiceClient();
  const { data: profile } = await adminSb
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();
  if (!profile) return new NextResponse('profile not found', { status: 404 });

  const { data: otp } = await adminSb
    .from('phone_otps')
    .select('*')
    .eq('profile_id', profile.id)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return new NextResponse('진행 중인 인증 요청이 없습니다. 다시 시도해 주세요.', { status: 404 });
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return new NextResponse('인증번호가 만료되었습니다. 다시 요청해 주세요.', { status: 410 });
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return new NextResponse('시도 횟수를 초과했습니다. 새 인증번호를 요청해 주세요.', { status: 429 });
  }

  const codeHash = hashCode(code, salt);
  if (codeHash !== otp.code_hash) {
    await adminSb.from('phone_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
    return new NextResponse('인증번호가 일치하지 않습니다.', { status: 400 });
  }

  const now = new Date().toISOString();
  await adminSb.from('phone_otps').update({ verified_at: now }).eq('id', otp.id);
  await adminSb.from('profiles').update({
    phone_verified: true,
    phone_verified_at: now,
    phone: otp.phone,
  }).eq('id', profile.id);

  await adminSb.from('notifications').insert({
    profile_id: profile.id,
    type: 'phone_verified',
    title: '본인 확인이 완료되었습니다',
    message: '프로필에 "실명 확인" 배지가 노출됩니다.',
    link_url: '/mypage/phone-verification',
  });

  return NextResponse.json({ ok: true });
}
