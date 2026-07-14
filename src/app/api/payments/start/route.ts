import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { preRegisterPayment } from '@/features/payments/lib/portone';
import { isPaymentSku, PAYMENT_CATALOG, type PaymentSku } from '@/features/payments/lib/payment-catalog';

export const dynamic = 'force-dynamic';

interface StartInput {
  sku: PaymentSku;
}

export async function POST(req: Request) {
  const deadline = AbortSignal.any([req.signal, AbortSignal.timeout(15_000)]);
  const viewer = await getVerifiedProfile(deadline);
  if (!viewer.ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: StartInput;
  try {
    body = (await req.json()) as StartInput;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!isPaymentSku(body.sku)) return NextResponse.json({ error: 'invalid_sku' }, { status: 400 });
  const product = PAYMENT_CATALOG[body.sku];
  const supabase = createServiceClient(deadline);

  // DB에 결제 세션 생성 (pending)
  const { data: payment, error } = await supabase.rpc('create_payment_session', {
    p_profile_id: viewer.profileId,
    p_product_type: product.productType,
    p_product_id: null,
    p_amount: product.amount,
    p_metadata: product.metadata,
  });

  if (error || !payment) {
    return NextResponse.json({ error: error?.message ?? 'create_failed' }, { status: 500 });
  }

  // 포트원에 사전 등록 (금액 위변조 방지)
  try {
    await preRegisterPayment({
      paymentId: payment.id,
      totalAmount: product.amount,
      currency: 'KRW',
      signal: deadline,
    });
  } catch (err) {
    console.error('[payments/start] pre-register failed:', err instanceof Error ? err.message : err);
    // 사전등록 timeout으로 위 deadline이 이미 abort됐을 수 있으므로 독립된 짧은
    // deadline으로 pending 정리를 끝낸다. RPC는 pending만 바꿔 결제 완료와 경합해도 안전하다.
    try {
      const { error: markError } = await createServiceClient(AbortSignal.timeout(5_000)).rpc('mark_payment_failed', {
        p_payment_id: payment.id,
        p_reason: 'pre_register_failed',
      });
      if (markError) console.error('[payments/start] mark_failed failed:', markError.message);
    } catch (markError) {
      console.error('[payments/start] mark_failed request failed:', markError);
    }
    return NextResponse.json({ error: 'payment_gateway_unavailable' }, { status: 503 });
  }

  return NextResponse.json({
    paymentId: payment.id,
    storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
    channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
    amount: product.amount,
    orderName: product.orderName,
  });
}
