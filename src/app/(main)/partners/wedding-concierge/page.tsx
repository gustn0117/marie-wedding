import Link from 'next/link';
import PageHeader from '@/shared/components/PageHeader';
import { ROUTES } from '@/shared/constants';

export const metadata = {
  title: '웨딩 컨시어지 | Marié',
  description: '신부님과 업체를 1:1로 연결하는 프리미엄 웨딩 컨시어지 서비스.',
};

const SERVICES = [
  {
    title: '맞춤 업체 매칭',
    desc: '예산·지역·예식 일정을 기반으로 검증된 예식장·드레스·스튜디오·메이크업·플래너를 1:1로 추천합니다.',
  },
  {
    title: '컨시어지 동행 상담',
    desc: '업체 방문 일정 조율부터 견적 비교, 계약 검토까지 전담 컨시어지가 동행해 의사결정을 돕습니다.',
  },
  {
    title: '문제 해결 핫라인',
    desc: '예식 진행 중 돌발 상황이 발생하면 24시간 핫라인으로 즉시 해결책을 안내합니다.',
  },
];

const HIGHLIGHTS = [
  { label: '검증된 업체', value: '300+' },
  { label: '평균 상담 응답', value: '15분' },
  { label: '만족도 평가', value: '4.8 / 5' },
];

export default function WeddingConciergePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="제휴업체"
        title="웨딩 컨시어지"
        description="신부님 한 분에게 전담 매니저 한 명. 업체 매칭부터 예식 당일까지 함께합니다."
        actions={
          <Link href="/contact" className="btn-primary text-sm">상담 신청</Link>
        }
      />

      <section className="bg-white border-y border-gray-200 px-5 py-10">
        <div className="max-w-3xl">
          <p className="text-[12px] font-bold text-primary uppercase tracking-wider mb-3">서비스 소개</p>
          <h2 className="text-[24px] sm:text-[32px] font-bold leading-tight tracking-tight text-ink">
            결혼 준비의 복잡함을<br />
            컨시어지 한 명으로 단순하게.
          </h2>
          <p className="mt-4 text-[15px] text-gray-600 leading-relaxed">
            신부님의 일정·예산·취향을 깊이 이해한 전담 컨시어지가
            업체 검색부터 견적 비교, 계약 검토, 예식 당일 진행까지
            결혼 준비의 모든 흐름을 함께 설계합니다.
          </p>
        </div>
      </section>

      <section>
        <p className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-3">컨시어지 하이라이트</p>
        <div className="bg-white border-y border-gray-200 grid grid-cols-3 divide-x divide-gray-100">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="px-4 py-6 text-center">
              <p className="text-[24px] sm:text-[28px] font-extrabold text-ink tabular-nums tracking-tight">{h.value}</p>
              <p className="mt-1 text-[12px] text-gray-500">{h.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-3">제공 서비스</p>
        <div className="grid gap-3 md:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title} className="bg-white border-y border-gray-200 px-5 py-6">
              <h3 className="text-[16px] font-bold text-ink mb-2">{s.title}</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary-50/60 border-y border-primary-100 px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-[12px] font-bold text-primary uppercase tracking-wider mb-2">진행 흐름</p>
          <h2 className="text-[22px] sm:text-[28px] font-bold leading-tight tracking-tight text-ink">
            상담 신청부터 예식 당일까지<br />
            컨시어지가 함께합니다.
          </h2>
          <ol className="mt-6 space-y-3">
            {[
              '상담 신청 — 예산·일정·지역·선호를 5분 안에 입력하세요.',
              '컨시어지 배정 — 1영업일 안에 전담 매니저가 연락드립니다.',
              '업체 매칭·견적 비교 — 평균 3~5개 추천, 매니저가 비교표를 정리합니다.',
              '계약 동행·당일 진행 — 계약 조항 검토와 예식 당일 진행 점검까지 함께합니다.',
            ].map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 text-[14px] text-gray-700">
                <span className="inline-flex w-6 h-6 rounded-full bg-primary text-white items-center justify-center text-[12px] font-bold shrink-0">{idx + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-ink text-white rounded-2xl px-6 py-10 sm:px-10 sm:py-14 flex flex-col items-start gap-4">
        <p className="text-[13px] font-bold text-primary-200">Marié 컨시어지</p>
        <h2 className="text-[22px] sm:text-[28px] font-bold leading-tight tracking-tight">
          첫 상담은 무료입니다.
        </h2>
        <p className="text-[14px] text-white/70 leading-relaxed">
          전담 컨시어지와 1:1 상담을 통해 현재 상황을 점검하고
          이후 진행 여부를 결정하실 수 있습니다.
        </p>
        <div className="flex gap-2 mt-2">
          <Link href="/contact" className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-white text-ink text-[14px] font-bold hover:bg-gray-100 transition-colors">상담 신청</Link>
          <Link href={ROUTES.DIRECTORY} className="inline-flex items-center justify-center h-11 px-5 rounded-xl border border-white/20 text-white text-[14px] font-bold hover:bg-white/10 transition-colors">검증 업체 보기</Link>
        </div>
      </section>

      <p className="text-center text-[11px] text-gray-400 pt-4">
        본 페이지의 내용은 임시 안내입니다. 정식 콘텐츠는 추후 업데이트 예정입니다.
      </p>
    </div>
  );
}
