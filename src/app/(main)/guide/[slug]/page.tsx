import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  formatGuideDate,
  getLanding,
  guideDateIso,
  relatedGuides,
  splitGuideItem,
  type Landing,
  type LandingSection,
} from '@/features/seo/landings';
import { getOpenJobs } from '@/features/seo/openJobs';
import {
  CareerPath,
  FaqList,
  GuideChecklist,
  GuideList,
  GuideNote,
  GuideTable,
  GuideTerms,
  GuideTimeline,
  RoleList,
  TipColumns,
} from '@/features/seo/components/GuideBlocks';
import GuideToc from '@/features/seo/components/GuideToc';
import { BUSINESS_TYPES, ROUTES } from '@/shared/constants';
import JobCard from '@/features/jobs/components/JobCard';
import JsonLd from '@/shared/components/JsonLd';
import Breadcrumb from '@/shared/components/Breadcrumb';
import {
  DEFAULT_OG_IMAGE,
  OG_SITE_NAME,
  SITE_URL,
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
  faqJsonLd,
} from '@/shared/seo';

// 가이드마다 해당 업종의 최신 모집중 공고를 함께 보여주므로 매 요청 조회한다.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const LATEST_JOBS_LIMIT = 6;
const H2 = 'break-keep text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]';
// 본문 섹션 — 가는 윗선으로 구분, 넉넉한 간격
const SECTION = 'border-t border-gray-200 py-10 first:border-t-0 first:pt-0 last:pb-0 sm:py-14';
const PARAGRAPH = 'max-w-[44em] break-keep text-[17px] leading-[1.85] text-gray-600';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) return { title: '가이드', robots: { index: false, follow: true } };
  return buildPageMetadata({
    title: landing.title,
    description: landing.description,
    path: `/guide/${landing.slug}`,
    type: 'article',
    keywords: landing.keywords,
    publishedTime: guideDateIso(landing.publishedAt),
    modifiedTime: guideDateIso(landing.updatedAt),
  });
}

/** 기사(Article) + 다루는 직업(Occupation) 구조화 데이터 — AI 검색이 '무엇에 관한 글인지'를 정확히 잡게 한다. */
function articleJsonLd(landing: Landing): Record<string, unknown> {
  const url = absoluteUrl(`/guide/${landing.slug}`);
  const org = { '@type': 'Organization', name: OG_SITE_NAME, url: SITE_URL };
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: landing.h1,
    description: landing.description,
    url,
    mainEntityOfPage: url,
    inLanguage: 'ko-KR',
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    datePublished: guideDateIso(landing.publishedAt),
    dateModified: guideDateIso(landing.updatedAt),
    author: org,
    publisher: { ...org, logo: { '@type': 'ImageObject', url: absoluteUrl(DEFAULT_OG_IMAGE) } },
    keywords: landing.keywords.join(', '),
    ...(landing.occupation
      ? {
          about: {
            '@type': 'Occupation',
            name: landing.occupation.name,
            alternateName: landing.occupation.alternateNames,
            description: landing.lead,
            skills: landing.occupation.skills.join(', '),
            ...(landing.roles?.length
              ? { responsibilities: landing.roles.map((r) => `${r.name}: ${r.desc}`).join(' ') }
              : {}),
            occupationLocation: { '@type': 'Country', name: 'KR' },
          },
        }
      : {}),
  };
}

/** 용어 풀이 섹션(itemStyle 'terms')이 있으면 DefinedTermSet — AI 검색이 '○○ 뜻'에 그대로 인용하기 좋다. */
function termsJsonLd(landing: Landing): Record<string, unknown> | null {
  const terms = landing.sections
    .filter((s) => s.itemStyle === 'terms')
    .flatMap((s) => s.items ?? [])
    .map(splitGuideItem)
    .filter((t): t is [string, string] => t[0] !== null);
  if (terms.length === 0) return null;
  const url = absoluteUrl(`/guide/${landing.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${url}#terms`,
    name: landing.h1,
    url,
    inLanguage: 'ko-KR',
    hasDefinedTerm: terms.map(([name, description]) => ({
      '@type': 'DefinedTerm',
      name,
      description,
      inDefinedTermSet: `${url}#terms`,
    })),
  };
}

/** '지금 모집 중인 ○○ 공고' 의 ○○ — 업종 이름. 전체 업종이면 '웨딩 채용' */
function jobsLabel(landing: Landing): string {
  if (landing.businessTypes.length === 0) return '웨딩 채용';
  return landing.businessTypes
    .map((t) => BUSINESS_TYPES.find((b) => b.value === t)?.label ?? t)
    .join('·');
}

function SectionBody({ section }: { section: LandingSection }) {
  const items = section.items ?? [];
  const style = section.itemStyle ?? 'list';
  return (
    <div className="mt-7 space-y-6">
      {section.body?.map((p) => (
        <p key={p} className={PARAGRAPH}>{p}</p>
      ))}
      {items.length > 0 && style === 'steps' && <GuideTimeline items={items} />}
      {items.length > 0 && style === 'check' && <GuideChecklist items={items} />}
      {items.length > 0 && style === 'terms' && <GuideTerms items={items} />}
      {items.length > 0 && style === 'list' && <GuideList items={items} />}
      {section.table && <GuideTable head={section.table.head} rows={section.table.rows} />}
      {section.note && <GuideNote>{section.note}</GuideNote>}
    </div>
  );
}

const SUMMARY_COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) notFound();

  const jobs = await getOpenJobs({ businessTypes: landing.businessTypes, limit: LATEST_JOBS_LIMIT });
  const jobsHref = landing.businessTypes.length > 0
    ? `${ROUTES.JOBS}?businessType=${landing.businessTypes.join(',')}`
    : ROUTES.JOBS;
  const forEmployer = landing.category === 'employer';
  const roles = landing.roles ?? [];
  const summary = landing.summary ?? [];
  const rolesHeading = landing.rolesHeading ?? '이런 자리가 있어요';
  const jobsHeading = `지금 모집 중인 ${jobsLabel(landing)} 공고`;
  const tipColumns = [
    ...(landing.tips?.seeker?.length
      ? [{ title: '구직자라면', items: landing.tips.seeker, action: { label: '이력서 등록하기', href: ROUTES.MYPAGE_RESUMES } }]
      : []),
    ...(landing.tips?.employer?.length
      ? [{ title: '업체라면', items: landing.tips.employer, action: { label: '채용 공고 무료로 등록하기', href: ROUTES.JOBS_NEW } }]
      : []),
  ];
  const tipsHeading = tipColumns.length > 1 ? '지원·채용 팁' : forEmployer ? '채용 담당자를 위한 팁' : '구직자를 위한 팁';
  const moreGuides = relatedGuides(landing);
  const terms = termsJsonLd(landing);
  const toc = [
    ...(roles.length > 0 ? [{ id: 'roles', label: rolesHeading }] : []),
    ...landing.sections.map((s) => ({ id: s.id, label: s.heading })),
    ...(landing.career ? [{ id: 'career', label: '성장 경로' }] : []),
    ...(tipColumns.length > 0 ? [{ id: 'tips', label: tipsHeading }] : []),
    { id: 'jobs', label: '모집 중인 공고' },
    { id: 'faq', label: '자주 묻는 질문' },
  ];
  // 채용 담당자 가이드는 공고 등록을, 나머지는 공고 보기를 먼저 권한다.
  const primaryCta = forEmployer
    ? { href: ROUTES.JOBS_NEW, label: '채용 공고 무료 등록' }
    : { href: jobsHref, label: '모집 중인 공고 보기' };
  const secondaryCta = forEmployer
    ? { href: ROUTES.DIRECTORY, label: '인재 프로필 보기' }
    : { href: ROUTES.DIRECTORY, label: '인재·업체 프로필 보기' };

  return (
    <article className="pb-16">
      <JsonLd data={articleJsonLd(landing)} />
      <JsonLd data={faqJsonLd(landing.faq)} />
      {terms && <JsonLd data={terms} />}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '채용 가이드', path: '/guide' },
          { name: landing.eyebrow, path: `/guide/${landing.slug}` },
        ])}
      />

      {/* 머리 — 제목·정의문, 한눈에 보기(가로 띠) */}
      <header className="pt-2">
        <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '채용 가이드', href: '/guide' }, { label: landing.eyebrow }]} />
        <h1 className="mt-8 max-w-[18em] break-keep text-[32px] font-bold leading-[1.2] tracking-[-0.035em] text-ink sm:text-[44px] lg:text-[52px]">
          {landing.h1}
        </h1>
        <p className="mt-6 max-w-[44em] break-keep text-[17px] leading-[1.85] text-gray-600 sm:text-[18px]">{landing.lead}</p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex flex-wrap gap-2">
            <Link
              href={primaryCta.href}
              className="inline-flex h-12 items-center rounded-lg bg-primary px-6 text-[15px] font-bold text-white transition-colors hover:bg-primary-dark"
            >
              {primaryCta.label}
            </Link>
            <Link
              href={secondaryCta.href}
              className="inline-flex h-12 items-center rounded-lg border border-gray-300 px-6 text-[15px] font-bold text-gray-700 transition-colors hover:border-ink hover:text-ink"
            >
              {secondaryCta.label}
            </Link>
          </div>
          <p className="text-[13px] text-gray-500">
            최종 업데이트 <time dateTime={landing.updatedAt}>{formatGuideDate(landing.updatedAt)}</time>
          </p>
        </div>

        {summary.length > 0 && (
          <dl className={`mt-14 grid border-t border-gray-200 lg:border-b ${SUMMARY_COLS[summary.length] ?? 'lg:grid-cols-4'}`}>
            {summary.map((f) => (
              <div
                key={f.label}
                className="border-b border-gray-200 py-5 lg:border-b-0 lg:border-l lg:px-6 lg:py-7 lg:first:border-l-0 lg:first:pl-0"
              >
                <dt className="text-[13px] font-medium text-gray-500">{f.label}</dt>
                <dd className="mt-2 break-keep text-[16px] font-semibold leading-[1.55] text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* 휴대폰·태블릿 목차 — 한 줄 가로 스크롤 */}
        <nav aria-label="목차" className="mt-8 lg:hidden">
          <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
            {toc.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border border-gray-200 px-4 text-[14px] text-gray-700 transition-colors hover:border-ink hover:text-ink"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {/* 본문 — lg 이상: 왼쪽 목차(따라다님) + 넓은 본문 */}
      <div className="mt-12 lg:mt-20 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-16">
        <aside className="hidden lg:block">
          <GuideToc items={toc} />
        </aside>

        <div className="min-w-0">
          {roles.length > 0 && (
            <section id="roles" className={SECTION}>
              <h2 className={H2}>{rolesHeading}</h2>
              <div className="mt-7">
                <RoleList roles={roles} />
              </div>
            </section>
          )}

          {landing.sections.map((sec) => (
            <section key={sec.id} id={sec.id} className={SECTION}>
              <h2 className={H2}>{sec.heading}</h2>
              <SectionBody section={sec} />
            </section>
          ))}

          {landing.career && (
            <section id="career" className={SECTION}>
              <h2 className={H2}>성장 경로</h2>
              <div className="mt-7">
                <CareerPath steps={landing.career.steps} note={landing.career.note} />
              </div>
            </section>
          )}

          {tipColumns.length > 0 && (
            <section id="tips" className={SECTION}>
              <h2 className={H2}>{tipsHeading}</h2>
              <div className="mt-8">
                <TipColumns columns={tipColumns} />
              </div>
            </section>
          )}

          <section id="jobs" className={SECTION}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <h2 className={H2}>{jobsHeading}</h2>
              <Link
                href={jobsHref}
                className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-gray-600 underline decoration-gray-300 underline-offset-4 hover:text-ink hover:decoration-ink"
              >
                전체 공고 보기
              </Link>
            </div>
            {jobs.length > 0 ? (
              <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <div className="mt-7 border-y border-gray-200 py-10">
                <p className="text-[17px] font-semibold text-ink">지금은 모집 중인 공고가 없어요</p>
                <p className="mt-1.5 text-[15px] text-gray-600">새 공고가 올라오면 이곳과 채용정보에 바로 보입니다. 사람을 찾고 있다면 공고를 먼저 올려 보세요.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={ROUTES.JOBS_NEW} className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-[14px] font-bold text-white transition-colors hover:bg-primary-dark">채용 공고 등록하기</Link>
                  <Link href={ROUTES.JOBS} className="inline-flex h-11 items-center rounded-lg border border-gray-300 px-5 text-[14px] font-bold text-gray-700 transition-colors hover:border-ink hover:text-ink">전체 채용정보 보기</Link>
                </div>
              </div>
            )}
          </section>

          <section id="faq" className={SECTION}>
            <h2 className={H2}>자주 묻는 질문</h2>
            <div className="mt-7">
              <FaqList faq={landing.faq} />
            </div>
          </section>
        </div>
      </div>

      {/* 함께 보면 좋은 가이드 */}
      <section aria-labelledby="more-guides" className="mt-14 border-t border-gray-200 pt-10 sm:mt-20 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 id="more-guides" className={H2}>함께 보면 좋은 가이드</h2>
          <Link
            href="/guide"
            className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-gray-600 underline decoration-gray-300 underline-offset-4 hover:text-ink hover:decoration-ink"
          >
            전체 가이드 보기
          </Link>
        </div>
        <ul className="mt-7 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
          {moreGuides.map((g) => (
            <li key={g.slug} className="border-t border-gray-200">
              <Link href={`/guide/${g.slug}`} className="group block py-5">
                <p className="text-[16px] font-bold text-ink underline-offset-4 group-hover:underline">{g.eyebrow}</p>
                <p className="mt-1.5 line-clamp-2 break-keep text-[14px] leading-[1.65] text-gray-500">{g.lead}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 시작 안내 */}
      <section className="mt-14 rounded-2xl bg-primary px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-14 lg:py-14">
        <div>
          <h2 className="break-keep text-[24px] font-bold leading-[1.35] sm:text-[28px]">공고 등록과 지원은 모두 무료예요</h2>
          <p className="mt-2 break-keep text-[15px] text-white/75">웨딩 업계 공고와 인재만 모여 있어 필요한 자리와 사람을 찾기 쉬워요.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 lg:mt-0 lg:shrink-0">
          <Link href={jobsHref} className="inline-flex h-12 items-center rounded-lg bg-white px-6 text-[15px] font-bold text-primary transition-colors hover:bg-gray-100">채용 공고 보기</Link>
          <Link href={ROUTES.JOBS_NEW} className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-[15px] font-bold text-white transition-colors hover:bg-white/10">채용 공고 등록</Link>
        </div>
      </section>
    </article>
  );
}
