import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { getSmsAdapter } from '@/lib/sms/adapter';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_TTL_MIN = 5;
const RATE_LIMIT_PER_HOUR = 5;

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

  const body = await req.json().catch(() => null) as { phone?: string } | null;
  const phone = body?.phone?.replace(/[^0-9]/g, '');
  if (!phone || !/^01[016789][0-9]{7,8}$/.test(phone)) {
    return new NextResponse('휴대폰 번호 형식이 올바르지 않습니다.', { status: 400 });
  }

  const adminSb = createServiceClient();
  const { data: profile } = await adminSb
    .from('profiles')
    .select('id, phone_verified')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();
  if (!profile) return new NextResponse('profile not found', { status: 404 });

  // 시간당 발송 제한
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await adminSb
    .from('phone_otps')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .gte('created_at', oneHourAgo);
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return new NextResponse('시간당 발송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.', { status: 429 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString();

  const { error } = await adminSb.from('phone_otps').insert({
    profile_id: profile.id,
    phone,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (error) return new NextResponse('OTP 저장 실패: ' + error.message, { status: 500 });

  const sms = getSmsAdapter();
  await sms.send(phone, `[Marié] 인증번호 ${code} (${OTP_TTL_MIN}분 이내 입력)`);

  return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MIN });
}
