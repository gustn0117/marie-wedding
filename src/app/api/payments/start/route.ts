import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { preRegisterPayment } from '@/features/payments/lib/portone';

export const dynamic = 'force-dynamic';

interface StartInput {
  productType: 'premium_tier' | 'job_promotion' | 'event_listing' | 'directory_boost';
  productId?: string;
  amount: number;
  metadata?: Record<string, unknown>;
}

export async function POST(req: Request) {
  // 인증 가드
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile')?.value;
  if (!profileCookie) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let profileId: string;
  try {
    profileId = JSON.parse(profileCookie).id;
    if (!profileId) throw new Error();
  } catch {
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
  }

  let body: StartInput;
  try {
    body = (await req.json()) as StartInput;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!body.productType || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }
  if (body.amount > 100_000_000) {
    return NextResponse.json({ error: 'amount_too_large' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // DB에 결제 세션 생성 (pending)
  const { data: payment, error } = await supabase.rpc('create_payment_session', {
    p_profile_id: profileId,
    p_product_type: body.productType,
    p_product_id: body.productId ?? null,
    p_amount: body.amount,
    p_metadata: body.metadata ?? {},
  });

  if (error || !payment) {
    return NextResponse.json({ error: error?.message ?? 'create_failed' }, { status: 500 });
  }

  // 포트원에 사전 등록 (금액 위변조 방지)
  try {
    await preRegisterPayment({
      paymentId: payment.id,
      totalAmount: body.amount,
      currency: 'KRW',
    });
  } catch (err) {
    // 사전 등록 실패해도 결제 자체는 시도 가능 (포트원 secret 미설정 시 등 dev 환경)
    console.warn('[payments/start] pre-register skipped:', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({
    paymentId: payment.id,
    storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
    channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
    amount: body.amount,
  });
}
