import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return new NextResponse('unauthorized', { status: 401 });
  const accessToken = auth.slice('Bearer '.length);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const userSb = createSbClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return new NextResponse('unauthorized', { status: 401 });

  const adminSb = createServiceClient();
  const { data: caller } = await adminSb
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();
  if (caller?.role !== 'admin') return new NextResponse('forbidden', { status: 403 });

  const body = await req.json().catch(() => null) as {
    profileId?: string;
    decision?: 'verified' | 'rejected';
    reason?: string;
  } | null;
  if (!body?.profileId || !body.decision) {
    return new NextResponse('잘못된 요청입니다.', { status: 400 });
  }
  if (body.decision === 'rejected' && !body.reason?.trim()) {
    return new NextResponse('거절 사유를 입력해 주세요.', { status: 400 });
  }

  const { error } = await adminSb.from('profiles').update({
    verification_status: body.decision,
    verification_reject_reason: body.decision === 'rejected' ? body.reason : null,
  }).eq('id', body.profileId);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
