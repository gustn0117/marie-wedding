import type { Metadata } from 'next';
import Link from 'next/link';
import { LANDINGS, formatGuideDate } from '@/features/seo/landings';
import { ArrowIcon } from '@/features/seo/components/GuideBlocks';
import { ROUTES } from '@/shared/constants';
import JsonLd from '@/shared/components/JsonLd';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { OG_SITE_NAME, absoluteUrl, breadcrumbJsonLd, buildPageMetadata } from '@/shared/seo';

// 채용 가이드 모음 — 업종별 가이드를 한곳에 모아 내부 링크 허브 역할을 한다.
const TITLE = '웨딩 업계 채용 가이드 — 직무별 하는 일·취업 방법';
const DESCRIPTION =
  '예식장·웨딩플래너·드레스샵·스튜디오·헤어메이크업·예식 도우미까지, 웨딩 업계 직무별 하는 일과 필요한 역량, 근무 형태와 지원 방법을 정리한 마리에 채용 가이드 모음입니다.';

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/guide',
  keywords: ['웨딩 채용 가이드', '웨딩 업계 직무', '웨딩 업계 취업', '웨딩 구인구직', '웨딩 직업'],
});

// 전체를 다루는 '웨딩 구인구직'을 맨 앞에, 나머지는 등록 순서대로.
const GUIDES = [...LANDINGS].sort((a, b) => Number(b.businessTypes.length === 0) - Number(a.businessTypes.length === 0));
const LAST_UPDATED = GUIDES.map((g) => g.updatedAt).sort().at(-1) ?? '';

export default function GuideIndexPage() {
  const url = absoluteUrl('/guide');
  return (
    <div className="pb-16">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: TITLE,
          description: DESCRIPTION,
          url,
          inLanguage: 'ko-KR',
          publisher: { '@type': 'Organization', name: OG_SITE_NAME, url: absoluteUrl('/') },
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: GUIDES.map((g, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: absoluteUrl(`/guide/${g.slug}`),
              name: g.h1,
            })),
          },
        }}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: '홈', path: '/' }, { name: '채용 가이드', path: '/guide' }])} />

      <header className="border-b border-gray-200 pb-10 sm:pb-12">
        <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '채용 가이드' }]} />
        <h1 className="mt-6 break-keep text-[30px] font-bold leading-[1.22] tracking-[-0.03em] text-ink sm:text-[40px] lg:text-[48px]">
          웨딩 업계 채용 가이드
        </h1>
        <p className="mt-5 max-w-[860px] break-keep text-[16px] leading-[1.8] text-gray-600 sm:text-[17px]">
          웨딩 업계는 예식장, 웨딩플래너, 드레스샵, 스튜디오, 헤어메이크업, 예식 도우미처럼 여러 직군이 함께 한 번의 예식을 만듭니다.
          직무별로 하는 일과 필요한 역량, 근무 형태와 지원 방법을 정리했습니다. 궁금한 직무를 골라 보세요.
        </p>
        {LAST_UPDATED && (
          <p className="mt-5 text-[13px] text-gray-500">
            최종 업데이트 <time dateTime={LAST_UPDATED}>{formatGuideDate(LAST_UPDATED)}</time> · 가이드 {GUIDES.length}개
          </p>
        )}
      </header>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/guide/${g.slug}`} className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 transition-colors hover:border-primary">
              <p className="text-[13px] font-bold text-primary">{g.eyebrow}</p>
              <h2 className="mt-2 break-keep text-[18px] font-bold leading-snug text-ink">{g.h1}</h2>
              <p className="mt-3 line-clamp-3 break-keep text-[14px] leading-relaxed text-gray-600">{g.lead}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-[14px] font-semibold text-gray-500 transition-colors group-hover:text-primary">
                가이드 보기 <ArrowIcon className="h-3.5 w-3.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-14 rounded-2xl bg-primary px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-14 lg:py-12">
        <div>
          <p className="text-[22px] font-bold sm:text-[26px]">원하는 자리를 찾으셨나요?</p>
          <p className="mt-2 text-[15px] text-white/80">채용정보에서 업종·지역·고용형태로 공고를 골라 보세요. 공고 등록·지원 모두 무료입니다.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 lg:mt-0 lg:shrink-0">
          <Link href={ROUTES.JOBS} className="inline-flex h-12 items-center rounded-lg bg-white px-6 text-[15px] font-bold text-primary transition-colors hover:bg-gray-100">채용정보 보기</Link>
          <Link href={ROUTES.JOBS_NEW} className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-[15px] font-bold text-white transition-colors hover:bg-white/10">채용 공고 등록</Link>
        </div>
      </section>
    </div>
  );
}
