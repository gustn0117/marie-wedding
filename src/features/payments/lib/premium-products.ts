/**
 * 프리미엄 등급 상품 카탈로그. 추후 DB(settings) 테이블로 분리 가능.
 */

export interface PremiumProduct {
  tier: 'basic' | 'pro' | 'enterprise';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  highlight?: boolean;
}

export const PREMIUM_PRODUCTS: PremiumProduct[] = [
  {
    tier: 'basic',
    name: '베이직',
    monthlyPrice: 29000,
    yearlyPrice: 290000,
    features: [
      '디렉토리 상단 우선 노출',
      '월 견적 발송 30건',
      '계약서 PDF 무제한',
      '이메일 알림',
    ],
  },
  {
    tier: 'pro',
    name: '프로',
    monthlyPrice: 79000,
    yearlyPrice: 790000,
    highlight: true,
    features: [
      '디렉토리 최상단 PREMIUM 배지',
      '월 견적 발송 무제한',
      '계약서·정산서 PDF 무제한',
      '카카오 알림톡 발송',
      '실시간 KPI 대시보드',
      '플랫폼 수수료 3% (기본 5%)',
    ],
  },
  {
    tier: 'enterprise',
    name: '엔터프라이즈',
    monthlyPrice: 0,           // 별도 협의 (0 = 문의)
    yearlyPrice: 0,
    features: [
      '프로 모든 기능 포함',
      '업체 내 직원 권한 분리 (오너/매니저/스태프)',
      'API 액세스',
      '전담 매니저',
      '맞춤형 계약서 양식',
      '수수료 별도 협상',
    ],
  },
];
