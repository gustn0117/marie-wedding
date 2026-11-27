import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { getLanding, type LandingRole } from '@/features/seo/landings';

// 처음 온 사람이 '마리에가 무엇이고 어디로 가면 되는지'를 바로 아는 길 셋.
// 공고 등록·지원 무료, 업종·지역·고용 형태 필터, 가이드 주제는 모두 서비스 소개(/about)와 같은 확인된 사실만 쓴다.
const PATHS = [
  {
    title: '일자리를 찾는다면',
    desc: '업종·지역·고용 형태별로 웨딩업계 채용 공고를 찾고, 등록해 둔 이력서로 바로 지원하세요.',
    href: ROUTES.JOBS,
    cta: '채용 공고 보기',
  },
  {
    title: '함께 일할 사람을 찾는다면',
    desc: '예식장·드레스샵·스튜디오 같은 웨딩 업체는 구인 공고를 무료로 올리고 지원자를 바로 받을 수 있습니다.',
    href: ROUTES.JOBS_NEW,
    cta: '무료 공고 등록',
  },
  {
    title: '웨딩업계가 처음이라면',
    desc: '직무별로 하는 일과 근무 형태, 이력서·면접 준비까지 채용 가이드에 정리했습니다.',
    href: '/guide',
    cta: '채용 가이드 보기',
  },
] as const;

// 직군별 하는 일 — '웨딩 구인구직' 가이드(/guide/wedding-jobs)의 직군 설명을 그대로 쓰고 직군별 채용 가이드로 잇는다.
// 이 컴포넌트는 서버 컴포넌트라 가이드 데이터가 클라이언트 번들에 실리지 않는다.
const ROLES = (getLanding('wedding-jobs')?.roles ?? []).filter(
  (r): r is LandingRole & { href: string } => Boolean(r.href),
);

// 처음 온 사람이 묻는 것 — /about·가이드와 같은 확인된 사실만 쓴다(무료, 업종·지역·고용 형태 필터, 지원·채용 방법).
// 검색 결과 위 AI 요약이 '웨딩업계 채용은 어디서 보나'에 답할 때 인용할 수 있는 문장이기도 하다.
const FAQ = [
  {
    q: '웨딩업계 채용 공고는 어디서 볼 수 있나요?',
    a: '마리에 채용정보에서 예식장·드레스샵·스튜디오·헤어메이크업·웨딩플래너·예식도우미 공고를 업종·지역·고용 형태별로 골라 볼 수 있습니다.',
  },
  { q: '공고 등록이나 지원에 비용이 드나요?', a: '현재 채용 공고 등록과 지원은 모두 무료입니다.' },
  {
    q: '공고에는 어떻게 지원하나요?',
    a: '개인 회원으로 가입해 이력서를 등록해 두면 원하는 공고에 바로 지원할 수 있습니다. 지원 현황은 마이페이지에서 확인합니다.',
  },
  {
    q: '업체는 어떻게 직원을 구하나요?',
    a: '업체 회원으로 채용 공고를 올리면 지원자를 받아 마이페이지에서 관리합니다. 인재·업체 프로필에서 함께 일할 사람을 직접 찾을 수도 있습니다.',
  },
  {
    q: '가까운 지역 공고만 볼 수 있나요?',
    a: '전국의 웨딩 채용 공고를 다루며, 채용정보에서 지역을 고르면 가까운 공고만 모아 볼 수 있습니다.',
  },
  {
    q: '예식 날만 일하는 단기 알바도 있나요?',
    a: '예식 일정에 맞춰 일하는 단기 공고도 올라옵니다. 채용정보에서 고용 형태를 단기알바로 골라 보세요.',
  },
] as const;

/**
 * 메인 맨 아래 서비스 안내 — '웨딩업계 채용·구인구직' 플랫폼이라는 것을 본문 글로 밝힌다.
 * 히어로 문구는 시즌마다 바뀌므로, 검색엔진과 처음 온 사람이 읽을 서비스 설명은 여기에 고정해 둔다.
 * 네이버는 화면에 보이는 본문을 보고 문서의 주제를 판단하는데, 홈은 공고 카드 위주라 글이 적었다
 * (2026-11-27 측정: 보이는 글 약 1,600자, 경쟁 사이트 홈 약 6,300자). 직군 안내·자주 묻는 질문을 실제 정보로 채운다.
 * 앱(.app-hide)에서는 숨긴다 — 앱은 이미 설치한 사람이 쓰고, 같은 길이 아래 탭에 있다.
 */
export default function HomeIntro() {
  return (
    <section aria-labelledby="home-intro-title" className="app-hide border-t border-gray-100 bg-white py-10 sm:py-14">
      <div className="shell-wide lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <h2 id="home-intro-title" className="break-keep text-[20px] font-bold tracking-tight text-ink sm:text-[22px]">
            웨딩업계 채용, 마리에에서 한 번에
          </h2>
          <p className="mt-3 max-w-xl break-keep text-[14px] leading-relaxed text-gray-600 sm:text-[15px]">
            마리에는 웨딩업계 구인구직 플랫폼입니다. 예식장·웨딩홀, 드레스샵, 웨딩 스튜디오, 헤어메이크업, 웨딩플래너,
            예식도우미까지 웨딩업계 채용 공고만 모아 일할 사람과 일자리를 한곳에서 찾을 수 있습니다.
          </p>
        </div>

        <ul className="mt-7 grid gap-6 sm:grid-cols-3 sm:gap-5 lg:mt-1">
          {PATHS.map((p) => (
            <li key={p.title} className="flex flex-col border-t border-gray-200 pt-4">
              <h3 className="break-keep text-[15px] font-bold text-ink">{p.title}</h3>
              <p className="mt-1.5 flex-1 break-keep text-[13px] leading-relaxed text-gray-600">{p.desc}</p>
              <Link
                href={p.href}
                className="mt-1 inline-flex min-h-[44px] items-center gap-0.5 self-start text-[13px] font-bold text-gray-700 transition-colors hover:text-primary"
              >
                {p.cta}
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {ROLES.length > 0 && (
        <div className="shell-wide mt-10 sm:mt-14 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          <div>
            <h3 className="break-keep text-[16px] font-bold tracking-tight text-ink sm:text-[17px]">직군별 웨딩업계 채용</h3>
            <p className="mt-2 max-w-md break-keep text-[13px] leading-relaxed text-gray-600 sm:text-[14px]">
              직군마다 하는 일과 근무 형태가 다릅니다. 직군을 누르면 하는 일과 준비할 것을 정리한 채용 가이드로 이어집니다.
            </p>
          </div>
          <ul className="mt-4 grid border-t border-gray-200 sm:grid-cols-2 sm:gap-x-5 lg:mt-1 lg:grid-cols-3">
            {ROLES.map((r) => (
              <li key={r.href} className="border-b border-gray-100">
                <Link href={r.href} className="group block py-3">
                  <span className="text-[14px] font-bold text-ink transition-colors group-hover:text-primary">{r.name}</span>
                  <span className="mt-0.5 block break-keep text-[13px] leading-relaxed text-gray-600">{r.desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="shell-wide mt-10 sm:mt-14 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <h3 className="break-keep text-[16px] font-bold tracking-tight text-ink sm:text-[17px]">자주 묻는 질문</h3>
        <dl className="mt-4 grid gap-x-5 gap-y-5 border-t border-gray-200 pt-4 sm:grid-cols-2 lg:mt-1">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="break-keep text-[14px] font-bold text-ink">{f.q}</dt>
              <dd className="mt-1 break-keep text-[13px] leading-relaxed text-gray-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
