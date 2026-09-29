import type { Metadata } from 'next';
import Link from 'next/link';
import { LANDINGS, formatGuideDate } from '@/features/seo/landings';
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

      <header className="pt-2">
        <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '채용 가이드' }]} />
        <h1 className="mt-8 break-keep text-[32px] font-bold leading-[1.2] tracking-[-0.035em] text-ink sm:text-[44px] lg:text-[52px]">
          웨딩 업계 채용 가이드
        </h1>
        <p className="mt-6 max-w-[44em] break-keep text-[17px] leading-[1.85] text-gray-600 sm:text-[18px]">
          웨딩 업계는 예식장, 웨딩플래너, 드레스샵, 스튜디오, 헤어메이크업, 예식 도우미처럼 여러 직군이 함께 한 번의 예식을 만듭니다.
          직무별로 하는 일과 필요한 역량, 근무 형태와 지원 방법을 정리했습니다.
        </p>
        {LAST_UPDATED && (
          <p className="mt-6 text-[13px] text-gray-500">
            가이드 {GUIDES.length}개, 최종 업데이트 <time dateTime={LAST_UPDATED}>{formatGuideDate(LAST_UPDATED)}</time>
          </p>
        )}
      </header>

      <ul className="mt-14 grid gap-x-12 md:grid-cols-2">
        {GUIDES.map((g) => (
          <li key={g.slug} className="border-t border-gray-200">
            <Link href={`/guide/${g.slug}`} className="group block py-7">
              <h2 className="break-keep text-[20px] font-bold leading-[1.4] tracking-[-0.02em] text-ink underline-offset-[5px] group-hover:underline sm:text-[22px]">
                {g.h1}
              </h2>
              <p className="mt-2.5 line-clamp-2 max-w-[40em] break-keep text-[15px] leading-[1.75] text-gray-600">{g.lead}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-14 rounded-2xl bg-primary px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-14 lg:py-14">
        <div>
          <h2 className="break-keep text-[24px] font-bold leading-[1.35] sm:text-[28px]">원하는 자리를 찾아보세요</h2>
          <p className="mt-2 break-keep text-[15px] text-white/75">채용정보에서 업종·지역·고용형태로 공고를 고를 수 있어요. 공고 등록과 지원은 모두 무료예요.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 lg:mt-0 lg:shrink-0">
          <Link href={ROUTES.JOBS} className="inline-flex h-12 items-center rounded-lg bg-white px-6 text-[15px] font-bold text-primary transition-colors hover:bg-gray-100">채용정보 보기</Link>
          <Link href={ROUTES.JOBS_NEW} className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-[15px] font-bold text-white transition-colors hover:bg-white/10">채용 공고 등록</Link>
        </div>
      </section>
    </div>
  );
}
