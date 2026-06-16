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
    name: '공고 부스트',
    monthlyPrice: 29000,
    yearlyPrice: 290000,
    features: [
      '채용 공고 목록 상단 우선 노출',
      '공고 카드 부스트 배지',
      '직무·지역 검색 결과 노출 강화',
      '공고 성과 리포트 기본 제공',
    ],
  },
  {
    tier: 'pro',
    name: '채용 광고 패키지',
    monthlyPrice: 79000,
    yearlyPrice: 790000,
    highlight: true,
    features: [
      '공고 목록 최상단 PREMIUM 슬롯',
      '홈·채용 상세 네이티브 광고 노출',
      '월 공고 부스트 5회 포함',
      '지원 전환 성과 대시보드',
      '저장 검색 사용자 대상 재노출',
      '광고 소재 검수 우선 처리',
    ],
  },
  {
    tier: 'enterprise',
    name: '브랜드 스폰서',
    monthlyPrice: 0,           // 별도 협의 (0 = 문의)
    yearlyPrice: 0,
    features: [
      '홈/채용/커뮤니티 주요 배너 패키지',
      '지역·직무 카테고리 단독 스폰서 슬롯',
      '브랜드 프로필 큐레이션 노출',
      '전담 광고 운영 지원',
      '맞춤형 리포트',
      '캠페인 단가 별도 협의',
    ],
  },
];
