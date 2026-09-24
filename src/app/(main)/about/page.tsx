import type { Metadata } from 'next';
import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES } from '@/shared/constants';
import { LANDINGS } from '@/features/seo/landings';
import JsonLd from '@/shared/components/JsonLd';
import {
  SITE_URL,
  OG_SITE_NAME,
  CONTACT_EMAIL_DEFAULT,
  breadcrumbJsonLd,
  buildPageMetadata,
  faqJsonLd,
  organizationJsonLd,
} from '@/shared/seo';

// 브랜드 검색('마리에', '마리에 채용')과 AI 검색이 '마리에가 무엇인지' 답할 근거가 되는 소개 페이지.
// 확인된 사실(무료, 다루는 업종, 가입 방식, 문의처)만 쓴다.
const TITLE = '서비스 소개 — 웨딩 업계 채용·구인구직 플랫폼';
const DESCRIPTION =
  '마리에(Marié)는 예식장·드레스샵·스튜디오·헤어메이크업·웨딩플래너·예식 도우미까지 웨딩 업계에서 일하는 사람과 업체를 잇는 채용·구인구직 플랫폼입니다. 공고 등록과 지원은 무료입니다.';

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/about',
  keywords: ['마리에', 'Marié', '마리에 채용', '웨딩 채용 사이트', '웨딩 구인구직 사이트', '웨딩 업계 채용 플랫폼'],
});

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || CONTACT_EMAIL_DEFAULT;

const FEATURES = [
  { title: '채용정보', desc: '웨딩 업계 채용 공고를 업종·지역·고용형태별로 찾고, 등록해 둔 이력서로 바로 지원합니다.', href: ROUTES.JOBS },
  { title: '인재·업체 프로필', desc: '함께 일할 웨딩 업체와 인재를 업종·지역별로 찾아보고 연락합니다.', href: ROUTES.DIRECTORY },
  { title: '커뮤니티', desc: '업계 소식과 실무 노하우, 취업·채용 팁을 웨딩 업계 사람들과 나눕니다.', href: ROUTES.COMMUNITY },
  { title: '행사·박람회', desc: '웨딩 박람회와 채용 행사 일정을 확인합니다.', href: ROUTES.EVENTS },
] as const;

const STEPS = [
  { title: '회원가입', desc: '이메일 또는 카카오·네이버 계정으로 가입합니다. 개인 회원으로 시작해 나중에 업체 회원으로 전환할 수도 있습니다.' },
  { title: '이력서 또는 업체 정보 등록', desc: '구직자는 이력서(포트폴리오 첨부 가능)를, 업체는 업체 정보를 채워 둡니다.' },
  { title: '지원 · 공고 등록', desc: '구직자는 원하는 공고에 바로 지원하고, 업체는 채용 공고를 올려 지원자를 받습니다. 지원 현황과 메시지는 마이페이지에서 확인합니다.' },
] as const;

const FAQ = [
  { q: '마리에는 어떤 서비스인가요?', a: '마리에(Marié)는 웨딩 업계 전문 채용·구인구직 플랫폼입니다. 웨딩 채용 공고, 인재·업체 프로필, 업계 커뮤니티, 행사·박람회 정보를 한 곳에서 제공합니다.' },
  { q: '이용료가 있나요?', a: '현재 채용 공고 등록과 지원 모두 무료입니다.' },
  { q: '어떤 업종의 공고가 올라오나요?', a: `${BUSINESS_TYPES.filter((b) => b.value !== 'other').map((b) => b.label).join('·')} 등 웨딩 업계 전반의 채용 공고를 다룹니다.` },
  { q: '어느 지역 공고를 볼 수 있나요?', a: '전국의 웨딩 채용 공고를 다룹니다. 채용정보에서 지역을 골라 가까운 공고만 볼 수 있습니다.' },
  { q: '개인 회원과 업체 회원은 무엇이 다른가요?', a: '개인 회원은 이력서를 등록하고 공고에 지원합니다. 업체 회원은 채용 공고를 등록하고 지원자를 관리합니다. 개인 회원도 마이페이지에서 업체 회원으로 전환할 수 있습니다.' },
  { q: '문의는 어디로 하나요?', a: `고객센터의 문의하기 또는 이메일(${CONTACT_EMAIL})로 보내주시면 담당자가 확인 후 답변드립니다.` },
];

export default function AboutPage() {
  const guides = LANDINGS.map((l) => ({ href: `/guide/${l.slug}`, label: l.eyebrow }));

  return (
    <div className="mx-auto max-w-[860px] space-y-10 pb-16">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: `${OG_SITE_NAME} 서비스 소개`,
          url: `${SITE_URL}/about`,
          description: DESCRIPTION,
          inLanguage: 'ko-KR',
          about: { '@id': `${SITE_URL}/#organization` },
        }}
      />
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <JsonLd data={breadcrumbJsonLd([{ name: '홈', path: '/' }, { name: '서비스 소개', path: '/about' }])} />

      <header className="border-b border-gray-200 pb-6 pt-2">
        <p className="text-sm font-bold text-primary">서비스 소개</p>
        <h1 className="mt-2 text-[26px] sm:text-[34px] font-bold leading-[1.25] tracking-tight text-ink">
          마리에는 웨딩 업계 전문 채용 플랫폼입니다
        </h1>
        <p className="mt-3 text-[15px] sm:text-base leading-relaxed text-gray-600">
          마리에(Marié)는 예식장·드레스샵·스튜디오·헤어메이크업·웨딩플래너·예식 도우미까지, 웨딩 업계에서 일하는 사람과
          사람을 찾는 업체를 잇는 채용·구인구직 플랫폼입니다. 웨딩 업계만 다루기 때문에 필요한 공고와 사람을 관련 없는 정보에
          묻히지 않고 찾을 수 있습니다.
        </p>
      </header>

      <section>
        <h2 className="text-lg sm:text-xl font-bold text-ink">마리에에서 할 수 있는 일</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-xl border border-gray-200 p-5 hover:border-primary transition-colors"
            >
              <p className="text-[15px] font-bold text-ink group-hover:text-primary">{f.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg sm:text-xl font-bold text-ink">누구를 위한 서비스인가요?</h2>
        <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-gray-700">
          <p>
            <strong className="font-bold text-ink">웨딩 업계에서 일자리를 찾는 분</strong> — 신입부터 경력자까지, 정규직·계약직은 물론
            예식 일정에 맞춘 단기 알바까지 원하는 형태의 공고를 찾을 수 있습니다.
          </p>
          <p>
            <strong className="font-bold text-ink">사람을 구하는 웨딩 업체</strong> — 예식장, 드레스샵, 스튜디오, 메이크업샵, 웨딩 플래닝
            업체 등은 채용 공고를 무료로 올리고 웨딩 업계 경력자에게 바로 알릴 수 있습니다.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg sm:text-xl font-bold text-ink">이용 방법</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] font-bold text-ink">{s.title}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-gray-600">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg sm:text-xl font-bold text-ink">다루는 업종</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
          {BUSINESS_TYPES.map((b) => b.label).join(' · ')}
        </p>
        <h3 className="mt-5 text-[15px] font-bold text-ink">업종별 채용 가이드</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {guides.map((g) => (
            <li key={g.href}>
              <Link
                href={g.href}
                className="inline-flex min-h-[44px] items-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
              >
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-6">
        <h2 className="text-lg font-bold text-ink">자주 묻는 질문</h2>
        <div className="mt-4 divide-y divide-gray-200">
          {FAQ.map((f) => (
            <div key={f.q} className="py-4 first:pt-0 last:pb-0">
              <p className="text-[15px] font-bold text-gray-900">Q. {f.q}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-primary px-6 py-8 text-center text-white">
        <p className="text-lg font-bold">지금 마리에에서 시작하세요</p>
        <p className="mt-1 text-sm text-white/80">공고 등록·지원 모두 무료입니다.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href={ROUTES.JOBS} className="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary hover:bg-gray-100 transition-colors">채용 공고 보기</Link>
          <Link href={ROUTES.CONTACT} className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-colors">고객센터</Link>
        </div>
      </section>
    </div>
  );
}
