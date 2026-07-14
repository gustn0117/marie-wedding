import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 문의 처리 상태 변경 — 서명된 관리자 세션 쿠키로만 허용. */
export async function POST(req: Request) {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(10_000)]);
  const unlocked = await hasValidAdminSession();
  if (!unlocked) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || typeof id !== 'string' || (status !== 'open' && status !== 'resolved')) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  const supabase = createServiceClient(signal);
  const { error } = await supabase
    .from('support_inquiries')
    .update({ status })
    .eq('id', id)
    .abortSignal(signal);
  if (error) {
    console.error('[api/admin/inquiries/status] error:', error.message);
    return NextResponse.json(
      { error: signal.aborted ? '처리 시간이 초과되었습니다. 다시 시도해 주세요.' : '상태를 변경하지 못했습니다.' },
      { status: signal.aborted ? 504 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
