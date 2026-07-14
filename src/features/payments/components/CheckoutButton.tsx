'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/shared/components/Toast';
import { ROUTES } from '@/shared/constants';
import { apiFetch } from '@/shared/utils/apiFetch';
import type { PaymentSku } from '@/features/payments/lib/payment-catalog';

interface CheckoutInput {
  sku: PaymentSku;
}

export default function CheckoutButton({
  input,
  label,
  className = 'btn-primary',
  disabled = false,
}: {
  input: CheckoutInput;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      // 1. 서버에 결제 세션 생성 요청
      const res = await apiFetch('/api/payments/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: ctrl.signal,
      }, 15000);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'failed' }));
        if (err.error === 'unauthorized') {
          toast('로그인이 필요합니다.', 'error');
          router.push(ROUTES.LOGIN);
          return;
        }
        throw new Error(err.error || '결제 시작 실패');
      }

      const { paymentId, storeId, channelKey, amount, orderName } = await res.json();

      if (!storeId || !channelKey || storeId.includes('xxxxxxxx')) {
        toast('결제 GW가 아직 설정되지 않았습니다. 운영팀에 문의해 주세요.', 'error');
        return;
      }

      // 2. 포트원 SDK 동적 import + 결제 위젯 호출
      const PortOne = await import('@portone/browser-sdk/v2');
      const result = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId,
        orderName,
        totalAmount: amount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customer: undefined, // 추후 프로필 정보 매핑
        redirectUrl: `${window.location.origin}/mypage/payments?paid=${paymentId}`,
      });

      if (result?.code) {
        // 결제 실패
        toast(result.message || '결제 실패', 'error');
      } else {
        // 결제 성공 → webhook이 처리 → /mypage/payments에서 결과 확인
        toast('결제 요청이 완료되었습니다. 처리에 잠시 걸릴 수 있습니다.', 'success');
        router.push(`/mypage/payments?paid=${paymentId}`);
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      toast(isAbort ? '결제 요청이 너무 오래 걸려요. 다시 시도해주세요.' : (err instanceof Error ? err.message : '결제 처리 중 오류'), 'error');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={disabled || loading}
      className={`${className} ${loading ? 'opacity-70 cursor-wait' : ''}`}
    >
      {loading ? '결제 시작 중...' : label}
    </button>
  );
}
