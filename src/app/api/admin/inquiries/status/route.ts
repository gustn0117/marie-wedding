import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 문의 처리 상태 변경 — 관리자 잠금 해제(marie_admin_unlock) 쿠키로만 허용. */
export async function POST(req: Request) {
  const unlocked = cookies().get('marie_admin_unlock')?.value === '1';
  if (!unlocked) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || typeof id !== 'string' || (status !== 'open' && status !== 'resolved')) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from('support_inquiries').update({ status }).eq('id', id);
  if (error) {
    console.error('[api/admin/inquiries/status] error:', error.message);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
