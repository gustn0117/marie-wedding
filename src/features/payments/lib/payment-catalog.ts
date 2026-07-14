/**
 * 결제 금액과 혜택의 단일 기준점.
 * 브라우저는 SKU만 요청하고 금액/등급/기간은 서버가 이 카탈로그에서 결정한다.
 */
export const PAYMENT_CATALOG = {
  premium_basic_monthly: {
    productType: 'premium_tier',
    amount: 29_000,
    orderName: 'Marié 공고 부스트 (1개월)',
    metadata: { sku: 'premium_basic_monthly', tier: 'basic', cycle: 'monthly', durationDays: 30 },
  },
  premium_basic_yearly: {
    productType: 'premium_tier',
    amount: 290_000,
    orderName: 'Marié 공고 부스트 (1년)',
    metadata: { sku: 'premium_basic_yearly', tier: 'basic', cycle: 'yearly', durationDays: 365 },
  },
  premium_pro_monthly: {
    productType: 'premium_tier',
    amount: 79_000,
    orderName: 'Marié 채용 광고 패키지 (1개월)',
    metadata: { sku: 'premium_pro_monthly', tier: 'pro', cycle: 'monthly', durationDays: 30 },
  },
  premium_pro_yearly: {
    productType: 'premium_tier',
    amount: 790_000,
    orderName: 'Marié 채용 광고 패키지 (1년)',
    metadata: { sku: 'premium_pro_yearly', tier: 'pro', cycle: 'yearly', durationDays: 365 },
  },
} as const;

export type PaymentSku = keyof typeof PAYMENT_CATALOG;

export function isPaymentSku(value: unknown): value is PaymentSku {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PAYMENT_CATALOG, value);
}
