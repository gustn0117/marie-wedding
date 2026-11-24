import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

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

/**
 * 메인 맨 아래 서비스 안내 — '웨딩업계 채용' 플랫폼이라는 것을 본문 글로 밝힌다.
 * 히어로 문구는 시즌마다 바뀌므로, 검색엔진과 처음 온 사람이 읽을 서비스 설명은 여기에 고정해 둔다.
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
            마리에는 웨딩업계 채용만 모은 구인구직 플랫폼입니다. 예식장·웨딩홀, 드레스샵, 웨딩 스튜디오, 헤어메이크업,
            웨딩플래너, 예식도우미까지 웨딩업계에서 일할 사람과 일자리를 한곳에서 찾을 수 있습니다.
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
    </section>
  );
}
