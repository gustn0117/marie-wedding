import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPayment, verifyWebhookSignature } from '@/features/payments/lib/portone';

export const dynamic = 'force-dynamic';

/**
 * PortOne V2 Webhook.
 *
 * 흐름:
 *  1. 서명 검증 (HMAC-SHA256)
 *  2. payload에서 paymentId 추출
 *  3. 포트원 API로 결제 상세 직접 조회 (double-check)
 *  4. status에 따라 payments 테이블 업데이트
 *
 * V2 payload 예시:
 *  { type: 'Transaction.Paid', data: { paymentId: '...', status: 'PAID', amount: { total: 29000 } } }
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-portone-signature');

  // 서명 검증
  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: { type?: string; data?: { paymentId?: string; status?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const paymentId = payload.data?.paymentId;
  if (!paymentId) {
    return NextResponse.json({ error: 'no_payment_id' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 포트원 API로 결제 상세 직접 조회 (위변조 방지)
  let portonePayment;
  try {
    portonePayment = await getPayment(paymentId);
  } catch (err) {
    console.error('[webhook] getPayment failed:', err);
    return NextResponse.json({ error: 'gateway_query_failed' }, { status: 502 });
  }

  // 결제 상태에 따라 처리
  if (portonePayment.status === 'PAID') {
    // DB의 amount와 일치 확인 (금액 위변조 방지)
    const { data: dbPayment } = await supabase
      .from('payments')
      .select('amount')
      .eq('id', paymentId)
      .maybeSingle();

    if (dbPayment && dbPayment.amount !== portonePayment.amount.total) {
      console.error('[webhook] amount mismatch', { dbAmount: dbPayment.amount, gatewayAmount: portonePayment.amount.total });
      return NextResponse.json({ error: 'amount_mismatch' }, { status: 400 });
    }

    const { error } = await supabase.rpc('mark_payment_completed', {
      p_payment_id: paymentId,
      p_gateway_transaction_id: portonePayment.id,
      p_metadata: {
        paidAt: portonePayment.paidAt,
        receiptUrl: portonePayment.receiptUrl ?? null,
      },
    });
    if (error) {
      console.error('[webhook] mark_completed failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (portonePayment.status === 'FAILED' || portonePayment.status === 'CANCELLED') {
    await supabase.rpc('mark_payment_failed', {
      p_payment_id: paymentId,
      p_reason: portonePayment.failure?.reason ?? portonePayment.status,
    });
  }
  // VIRTUAL_ACCOUNT_ISSUED, PENDING, READY 등은 pending 유지

  return NextResponse.json({ ok: true });
}
