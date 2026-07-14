import 'server-only';

/**
 * PortOne V2 REST API wrapper (server-side).
 *
 * 환경변수:
 *  - PORTONE_API_SECRET: V2 API secret (server only)
 *  - PORTONE_WEBHOOK_SECRET: webhook 서명 검증용
 *  - NEXT_PUBLIC_PORTONE_STORE_ID: 상점 ID (client + server)
 *  - NEXT_PUBLIC_PORTONE_CHANNEL_KEY: 채널 키 (client only)
 *
 * 참고: https://developers.portone.io/api/rest-v2
 */

import { Webhook } from '@portone/server-sdk';

const PORTONE_API_BASE = 'https://api.portone.io';

export interface PortOnePayment {
  id: string;
  status: 'READY' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'PARTIAL_CANCELLED' | 'VIRTUAL_ACCOUNT_ISSUED';
  amount: { total: number; currency: string };
  orderName: string;
  customer?: { id?: string; name?: string; email?: string };
  failure?: { reason: string };
  paidAt?: string;
  receiptUrl?: string;
}

export class PortOneError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'PortOneError';
  }
}

function getApiSecret(): string {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret || secret.includes('your-portone')) {
    throw new PortOneError('PORTONE_API_SECRET not configured', 'NO_API_SECRET');
  }
  return secret;
}

/**
 * 결제 단건 조회 — webhook 검증 시 사용 (webhook payload만 신뢰 X, 직접 조회로 더블체크).
 */
export async function getPayment(paymentId: string): Promise<PortOnePayment> {
  const secret = getApiSecret();
  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: { Authorization: `PortOne ${secret}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new PortOneError(`PortOne getPayment failed: ${res.status} ${body}`, 'API_ERROR', res.status);
  }
  return (await res.json()) as PortOnePayment;
}

/**
 * 결제 사전 등록 — 결제 금액 위변조 방지용.
 * 결제 시작 전에 paymentId와 amount를 포트원에 미리 등록하면,
 * 클라이언트에서 위변조 시 결제 자체가 실패함.
 */
export async function preRegisterPayment(input: {
  paymentId: string;
  totalAmount: number;
  taxFreeAmount?: number;
  currency?: 'KRW' | 'USD';
  signal?: AbortSignal;
}): Promise<void> {
  const secret = getApiSecret();
  const body = {
    storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
    totalAmount: input.totalAmount,
    taxFreeAmount: input.taxFreeAmount ?? 0,
    currency: input.currency ?? 'KRW',
  };
  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(input.paymentId)}/pre-register`, {
    method: 'POST',
    headers: {
      Authorization: `PortOne ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: input.signal ?? AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 409) {
    // 409 = 이미 등록됨 (idempotent OK)
    const text = await res.text();
    throw new PortOneError(`pre-register failed: ${res.status} ${text}`, 'PRE_REGISTER_FAILED', res.status);
  }
}

/**
 * 결제 취소.
 */
export async function cancelPayment(paymentId: string, reason: string): Promise<void> {
  const secret = getApiSecret();
  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `PortOne ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new PortOneError(`cancel failed: ${res.status} ${text}`, 'CANCEL_FAILED', res.status);
  }
}

/**
 * webhook 서명 검증.
 * PortOne V2 Standard Webhooks의 id/timestamp/signature를 공식 SDK로 검증한다.
 */
export async function verifyWebhook(
  rawBody: string,
  headers: Headers,
): Promise<{ type: string; paymentId: string | null } | null> {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret || secret.includes('your-portone')) return null;
  try {
    const webhook = await Webhook.verify(secret, rawBody, Object.fromEntries(headers.entries()));
    if (Webhook.isUnrecognizedWebhook(webhook)) {
      return { type: 'Unrecognized', paymentId: null };
    }
    const data = webhook.data as unknown as Record<string, unknown>;
    return {
      type: webhook.type,
      paymentId: typeof data.paymentId === 'string' ? data.paymentId : null,
    };
  } catch (error) {
    console.warn('[portone] webhook verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
