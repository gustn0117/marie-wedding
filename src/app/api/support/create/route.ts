import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 고객센터 문의 접수 — support_inquiries 에 저장(service_role).
 * 비로그인도 가능. 로그인 상태면 profile_id 연결.
 */
export async function POST(req: Request) {
  try {
    const { name, phone, email, message } = await req.json().catch(() => ({}));
    const msg = typeof message === 'string' ? message.trim() : '';
    if (!msg) return NextResponse.json({ error: '문의 내용을 입력해주세요.' }, { status: 400 });
    if (msg.length > 5000) return NextResponse.json({ error: '문의 내용이 너무 깁니다. (5000자 이하)' }, { status: 400 });

    const phoneVal = typeof phone === 'string' ? phone.trim() : '';
    const emailVal = typeof email === 'string' ? email.trim() : '';
    if (!phoneVal && !emailVal) {
      return NextResponse.json({ error: '연락받을 전화번호나 이메일 중 하나는 입력해주세요.' }, { status: 400 });
    }

    let profileId: string | null = null;
    try {
      const pc = cookies().get('marie_profile');
      if (pc?.value) { const p = JSON.parse(pc.value); profileId = p?.id ?? null; }
    } catch { /* 비로그인 */ }

    const supabase = createServiceClient();
    const { error } = await supabase.from('support_inquiries').insert({
      profile_id: profileId,
      name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : null,
      phone: phoneVal ? phoneVal.slice(0, 40) : null,
      email: emailVal ? emailVal.slice(0, 200) : null,
      message: msg.slice(0, 5000),
    });
    if (error) {
      console.error('[api/support/create] insert error:', error.message);
      return NextResponse.json({ error: '문의 접수에 실패했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/support/create] failed:', err);
    return NextResponse.json({ error: '문의 접수에 실패했습니다.' }, { status: 500 });
  }
}
