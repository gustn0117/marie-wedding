import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDE_CATEGORIES, LANDINGS, formatGuideDate, guidesIn } from '@/features/seo/landings';
import { ROUTES } from '@/shared/constants';
import JsonLd from '@/shared/components/JsonLd';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { OG_SITE_NAME, absoluteUrl, breadcrumbJsonLd, buildPageMetadata } from '@/shared/seo';

// 채용 가이드 모음 — 모든 가이드를 분류별로 모아 내부 링크 허브 역할을 한다.
const TITLE = '웨딩 업계 채용 가이드 — 직무·알바 준비·채용 실무·웨딩 용어';
const DESCRIPTION =
  '예식장·웨딩플래너·드레스샵·스튜디오·헤어메이크업·예식 도우미 같은 웨딩 업계 직무 소개부터 알바 복장·보건증·이력서·면접 준비, 업체의 채용 실무, 예식 순서와 웨딩 용어까지 정리한 마리에 채용 가이드 모음입니다.';

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/guide',
  keywords: ['웨딩 채용 가이드', '웨딩 업계 직무', '웨딩 업계 취업', '웨딩 알바', '웨딩 용어', '웨딩 직업'],
});

// 분류 순서대로, 분류 안에서는 대표 가이드를 앞에.
const GROUPS = GUIDE_CATEGORIES.map((c) => ({ ...c, guides: guidesIn(c.id) })).filter((g) => g.guides.length > 0);
const GUIDES = GROUPS.flatMap((g) => g.guides);
const LAST_UPDATED = LANDINGS.map((g) => g.updatedAt).sort().at(-1) ?? '';

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
          직무 소개부터 일을 시작하기 전 준비, 업체의 채용 실무, 현장에서 쓰는 웨딩 용어까지 분류별로 정리했습니다.
        </p>
        {LAST_UPDATED && (
          <p className="mt-6 text-[13px] text-gray-500">
            가이드 {GUIDES.length}개, 최종 업데이트 <time dateTime={LAST_UPDATED}>{formatGuideDate(LAST_UPDATED)}</time>
          </p>
        )}

        {/* 분류 바로가기 */}
        <nav aria-label="가이드 분류" className="mt-10">
          <ul className="flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <li key={g.id}>
                <a
                  href={`#${g.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-gray-200 px-4 text-[15px] font-semibold text-gray-700 transition-colors hover:border-ink hover:text-ink"
                >
                  {g.label}
                  <span className="text-[13px] font-medium text-gray-400">{g.guides.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {GROUPS.map((group) => (
        <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="mt-16 sm:mt-20">
          <h2 id={`${group.id}-title`} className="break-keep text-[26px] font-bold leading-[1.3] tracking-[-0.025em] text-ink sm:text-[30px]">
            {group.label}
          </h2>
          <p className="mt-3 max-w-[44em] break-keep text-[16px] leading-[1.75] text-gray-600">{group.lead}</p>
          <ul className="mt-8 grid gap-x-12 md:grid-cols-2">
            {group.guides.map((g) => (
              <li key={g.slug} className="border-t border-gray-200">
                <Link href={`/guide/${g.slug}`} className="group block py-6">
                  <h3 className="break-keep text-[19px] font-bold leading-[1.45] tracking-[-0.02em] text-ink underline-offset-[5px] group-hover:underline sm:text-[20px]">
                    {g.h1}
                  </h3>
                  <p className="mt-2 line-clamp-2 max-w-[40em] break-keep text-[15px] leading-[1.75] text-gray-600">{g.lead}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-16 rounded-2xl bg-primary sm:mt-20 px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-14 lg:py-14">
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
