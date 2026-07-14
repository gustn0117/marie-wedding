import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPayment, verifyWebhook } from '@/features/payments/lib/portone';

export const dynamic = 'force-dynamic';

/**
 * PortOne V2 Webhook.
 *
 * 흐름:
 *  1. Standard Webhooks 서명/타임스탬프 검증
 *  2. payload에서 paymentId 추출
 *  3. 포트원 API로 결제 상세 직접 조회 (double-check)
 *  4. status에 따라 payments 테이블 업데이트
 *
 * V2 payload 예시:
 *  { type: 'Transaction.Paid', data: { paymentId: '...', status: 'PAID', amount: { total: 29000 } } }
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  // PortOne 공식 SDK로 Standard Webhooks의 id/timestamp/signature를 함께 검증한다.
  const webhook = await verifyWebhook(rawBody, req.headers);
  if (!webhook) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  const paymentId = webhook.paymentId;
  if (!paymentId) {
    // 결제 외 PortOne 이벤트는 처리할 내용이 없으므로 성공으로 종료한다.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const signal = AbortSignal.timeout(15_000);
  const supabase = createServiceClient(signal);
  const { data: dbPayment, error: dbError } = await supabase
    .from('payments')
    .select('amount, currency, status')
    .eq('id', paymentId)
    .maybeSingle();
  if (dbError) return NextResponse.json({ error: 'payment_lookup_failed' }, { status: 500 });
  if (!dbPayment) return NextResponse.json({ ok: true, ignored: true });

  // 포트원 API로 결제 상세 직접 조회 (위변조 방지)
  let portonePayment;
  try {
    portonePayment = await getPayment(paymentId);
  } catch (err) {
    console.error('[webhook] getPayment failed:', err);
    return NextResponse.json({ error: 'gateway_query_failed' }, { status: 502 });
  }

  // 게이트웨이 조회가 오래 걸렸더라도 DB 상태 기록에는 온전한 deadline을 준다.
  const stateClient = createServiceClient(AbortSignal.timeout(5_000));

  // 결제 상태에 따라 처리
  if (portonePayment.status === 'PAID') {
    // 서버 카탈로그로 저장한 DB 금액/통화와 게이트웨이 실결제를 모두 대조한다.
    if (dbPayment.amount !== portonePayment.amount.total || dbPayment.currency !== portonePayment.amount.currency) {
      console.error('[webhook] amount mismatch', { dbAmount: dbPayment.amount, gatewayAmount: portonePayment.amount.total });
      return NextResponse.json({ error: 'amount_mismatch' }, { status: 400 });
    }

    const { error } = await stateClient.rpc('mark_payment_completed', {
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
  } else if (
    dbPayment.status === 'pending'
    && (portonePayment.status === 'FAILED' || portonePayment.status === 'CANCELLED')
  ) {
    const { error } = await stateClient.rpc('mark_payment_failed', {
      p_payment_id: paymentId,
      p_reason: portonePayment.failure?.reason ?? portonePayment.status,
    });
    if (error) {
      console.error('[webhook] mark_failed failed:', error);
      // 5xx로 PortOne 재시도를 유도한다. terminal 상태 RPC는 idempotent하다.
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  // VIRTUAL_ACCOUNT_ISSUED, PENDING, READY 등은 pending 유지

  return NextResponse.json({ ok: true });
}
