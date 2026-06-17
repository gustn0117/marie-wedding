import Link from 'next/link';
import PageHeader from '@/shared/components/PageHeader';
import { ROUTES } from '@/shared/constants';

export const metadata = {
  title: '웨딩홀 마케팅 | Marié',
  description: 'Marié와 함께하는 웨딩홀 전용 마케팅 솔루션. 예약·상담 전환을 최대화하세요.',
};

const FEATURES = [
  {
    title: '예약 전환 최적화',
    desc: '신부님 검색 흐름에 맞춘 콘텐츠·랜딩·상담 동선을 설계해 실제 계약으로 이어지는 전환율을 끌어올립니다.',
  },
  {
    title: '브랜드 콘텐츠 운영',
    desc: '예식 현장·시즌 컬렉션·고객 후기를 일관된 톤으로 제작해 SNS·검색·리뷰 채널에 통합 배포합니다.',
  },
  {
    title: '성과 데이터 리포트',
    desc: '광고 비용 대비 상담·계약 전환을 주간/월간 대시보드로 가시화하고, A/B 테스트를 통해 캠페인을 개선합니다.',
  },
];

const STEPS = [
  { n: '01', title: '진단 미팅', desc: '현재 마케팅 현황과 KPI를 30분 안에 진단합니다.' },
  { n: '02', title: '전략 제안', desc: '예식 시즌·지역·타겟에 맞춘 3개월 단위 액션플랜을 제시합니다.' },
  { n: '03', title: '운영·리포트', desc: '전담 매니저가 콘텐츠 운영과 성과 분석을 매주 진행합니다.' },
];

export default function WeddingHallMarketingPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="제휴업체"
        title="웨딩홀 마케팅"
        description="예약과 계약으로 이어지는 웨딩홀 전용 마케팅 파트너십. 진단 → 전략 → 운영까지 한 화면에서."
        actions={
          <Link href="/contact" className="btn-primary text-sm">문의하기</Link>
        }
      />

      <section className="bg-white border-y border-gray-200 px-5 py-10">
        <div className="max-w-3xl">
          <p className="text-[12px] font-bold text-primary uppercase tracking-wider mb-3">왜 Marié인가요?</p>
          <h2 className="text-[24px] sm:text-[32px] font-bold leading-tight tracking-tight text-ink">
            웨딩홀 전용 마케팅을<br />
            한 곳에서 모두 운영합니다.
          </h2>
          <p className="mt-4 text-[15px] text-gray-600 leading-relaxed">
            웨딩 산업 데이터와 신부님 검색 흐름을 깊이 이해하는 Marié가
            검색·SNS·예약 전환까지 통합 마케팅을 직접 운영합니다.
            매월 정량 리포트로 비용 대비 효과를 명확히 확인할 수 있습니다.
          </p>
        </div>
      </section>

      <section>
        <p className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-3">핵심 서비스</p>
        <div className="grid gap-3 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white border-y border-gray-200 px-5 py-6">
              <h3 className="text-[16px] font-bold text-ink mb-2">{f.title}</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-3">진행 절차</p>
        <div className="bg-white border-y border-gray-200 divide-y divide-gray-100">
          {STEPS.map((s) => (
            <div key={s.n} className="flex items-start gap-4 px-5 py-5">
              <span className="text-[20px] font-extrabold text-primary tabular-nums shrink-0 w-10">{s.n}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink">{s.title}</p>
                <p className="text-[13px] text-gray-500 mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-white rounded-2xl px-6 py-10 sm:px-10 sm:py-14 flex flex-col items-start gap-4">
        <p className="text-[13px] font-bold text-primary-200">Marié 파트너십</p>
        <h2 className="text-[22px] sm:text-[28px] font-bold leading-tight tracking-tight">
          예약과 계약 전환을<br />
          데이터로 검증하세요.
        </h2>
        <p className="text-[14px] text-white/70 leading-relaxed">
          전담 매니저가 무료 진단을 도와드립니다. 진단 결과에 따라 시작 여부를 결정하셔도 됩니다.
        </p>
        <div className="flex gap-2 mt-2">
          <Link href="/contact" className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-white text-ink text-[14px] font-bold hover:bg-gray-100 transition-colors">무료 진단 문의</Link>
          <Link href={ROUTES.DIRECTORY} className="inline-flex items-center justify-center h-11 px-5 rounded-xl border border-white/20 text-white text-[14px] font-bold hover:bg-white/10 transition-colors">파트너 사례 보기</Link>
        </div>
      </section>

      <p className="text-center text-[11px] text-gray-400 pt-4">
        본 페이지의 내용은 임시 안내입니다. 정식 콘텐츠는 추후 업데이트 예정입니다.
      </p>
    </div>
  );
}
