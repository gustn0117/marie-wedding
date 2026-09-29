import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LANDINGS, formatGuideDate, getLanding, guideDateIso, type Landing } from '@/features/seo/landings';
import { getOpenJobs } from '@/features/seo/openJobs';
import { ArrowIcon, GuideItems, RoleCard, TipCard } from '@/features/seo/components/GuideBlocks';
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
// 본문 섹션 — 넓은 화면에서 제목(왼쪽)·내용(오른쪽) 두 단
const SECTION_GRID = 'grid gap-5 border-t border-gray-200 py-12 sm:py-14 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[360px_minmax(0,1fr)]';
const H2 = 'break-keep text-[22px] font-bold leading-snug tracking-[-0.02em] text-ink sm:text-[26px]';

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
            responsibilities: landing.roles.map((r) => `${r.name}: ${r.desc}`).join(' '),
            occupationLocation: { '@type': 'Country', name: 'KR' },
          },
        }
      : {}),
  };
}

/** '지금 모집 중인 ○○ 공고' 의 ○○ — 업종 이름. 전체 업종이면 '웨딩 채용' */
function jobsLabel(landing: Landing): string {
  if (landing.businessTypes.length === 0) return '웨딩 채용';
  return landing.businessTypes
    .map((t) => BUSINESS_TYPES.find((b) => b.value === t)?.label ?? t)
    .join('·');
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) notFound();

  const jobs = await getOpenJobs({ businessTypes: landing.businessTypes, limit: LATEST_JOBS_LIMIT });
  const jobsHref = landing.businessTypes.length > 0
    ? `${ROUTES.JOBS}?businessType=${landing.businessTypes.join(',')}`
    : ROUTES.JOBS;
  const rolesHeading = landing.rolesHeading ?? '이런 자리가 있어요';
  const otherGuides = LANDINGS.filter((l) => l.slug !== landing.slug);
  const toc = [
    { id: 'roles', label: rolesHeading },
    ...landing.sections.map((s) => ({ id: s.id, label: s.heading })),
    ...(landing.career ? [{ id: 'career', label: '성장 경로' }] : []),
    { id: 'tips', label: '지원·채용 팁' },
    { id: 'jobs', label: '모집 중인 공고' },
    { id: 'faq', label: '자주 묻는 질문' },
  ];

  return (
    <article className="pb-16">
      <JsonLd data={articleJsonLd(landing)} />
      <JsonLd data={faqJsonLd(landing.faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '채용 가이드', path: '/guide' },
          { name: landing.eyebrow, path: `/guide/${landing.slug}` },
        ])}
      />

      {/* 머리 — 제목·정의문(왼쪽) + 한눈에 보기(오른쪽) */}
      <header className="border-b border-gray-200 pb-10 sm:pb-12">
        <Breadcrumb items={[{ label: '홈', href: '/' }, { label: '채용 가이드', href: '/guide' }, { label: landing.eyebrow }]} />
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0">
            <p className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-[13px] font-bold text-primary">
              채용 가이드
            </p>
            <h1 className="mt-4 break-keep text-[30px] font-bold leading-[1.22] tracking-[-0.03em] text-ink sm:text-[40px] lg:text-[48px]">
              {landing.h1}
            </h1>
            <p className="mt-5 max-w-[760px] break-keep text-[16px] leading-[1.8] text-gray-600 sm:text-[17px]">{landing.lead}</p>
            <p className="mt-5 text-[13px] text-gray-500">
              마리에 채용 가이드 · 최종 업데이트{' '}
              <time dateTime={landing.updatedAt}>{formatGuideDate(landing.updatedAt)}</time>
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link
                href={jobsHref}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-[15px] font-bold text-white transition-colors hover:bg-primary-dark"
              >
                모집 중인 공고 보기 <ArrowIcon />
              </Link>
              <Link
                href={ROUTES.DIRECTORY}
                className="inline-flex h-12 items-center rounded-lg border border-gray-300 px-6 text-[15px] font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary"
              >
                인재·업체 프로필
              </Link>
            </div>
          </div>

          <aside aria-labelledby="summary-title" className="self-start rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-7">
            <h2 id="summary-title" className="text-[15px] font-bold text-ink">한눈에 보기</h2>
            <dl className="mt-2 divide-y divide-gray-200">
              {landing.summary.map((f) => (
                <div key={f.label} className="grid grid-cols-[84px_minmax(0,1fr)] gap-4 py-3.5 last:pb-0">
                  <dt className="text-[13px] font-semibold text-gray-500">{f.label}</dt>
                  <dd className="break-keep text-[14px] leading-relaxed text-ink sm:text-[15px]">{f.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <nav aria-label="목차" className="mt-10">
          <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {toc.map((t, i) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary sm:text-[14px]"
                >
                  <span className="text-gray-400">{String(i + 1).padStart(2, '0')}</span>
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {/* 세부 직무 */}
      <section id="roles" className="py-12 sm:py-14">
        <h2 className={H2}>{rolesHeading}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {landing.roles.map((role) => (
            <RoleCard key={role.name} role={role} />
          ))}
        </div>
      </section>

      {/* 본문 — 흐름·역량·근무 형태 */}
      {landing.sections.map((sec) => (
        <section key={sec.id} id={sec.id} className={SECTION_GRID}>
          <h2 className={H2}>{sec.heading}</h2>
          <div className="min-w-0 space-y-4">
            {sec.body?.map((p) => (
              <p key={p} className="break-keep text-[16px] leading-[1.85] text-gray-700">{p}</p>
            ))}
            {sec.items && <GuideItems items={sec.items} variant={sec.itemStyle ?? 'list'} />}
          </div>
        </section>
      ))}

      {/* 성장 경로 */}
      {landing.career && (
        <section id="career" className={SECTION_GRID}>
          <h2 className={H2}>성장 경로</h2>
          <div className="min-w-0">
            <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              {landing.career.steps.map((step, i) => (
                <li key={step} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="inline-flex min-h-[52px] items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-5 text-[15px] font-semibold text-ink sm:text-[16px]">
                    <span className="text-[13px] font-bold text-primary">{i + 1}</span>
                    {step}
                  </span>
                  {i < landing.career!.steps.length - 1 && (
                    <span aria-hidden className="pl-6 text-gray-300 sm:pl-0">
                      <ArrowIcon className="h-4 w-4 rotate-90 sm:rotate-0" />
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-5 break-keep text-[14px] leading-relaxed text-gray-500 sm:text-[15px]">{landing.career.note}</p>
          </div>
        </section>
      )}

      {/* 구직자·업체 팁 */}
      <section id="tips" className={SECTION_GRID}>
        <h2 className={H2}>지원·채용 팁</h2>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <TipCard title="구직자라면" items={landing.tips.seeker} action={{ label: '이력서 등록하기', href: ROUTES.MYPAGE_RESUMES }} />
          <TipCard title="업체라면" items={landing.tips.employer} action={{ label: '채용 공고 무료 등록', href: ROUTES.JOBS_NEW }} />
        </div>
      </section>

      {/* 최신 공고 — 가이드를 읽고 바로 지원으로 이어지게 */}
      <section id="jobs" className="border-t border-gray-200 py-12 sm:py-14">
        <div className="flex items-end justify-between gap-3">
          <h2 className={H2}>지금 모집 중인 {jobsLabel(landing)} 공고</h2>
          <Link href={jobsHref} className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-[14px] font-semibold text-gray-500 transition-colors hover:text-primary">
            전체 보기 <ArrowIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        {jobs.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <p className="text-[16px] font-semibold text-gray-800">지금은 모집 중인 공고가 없어요</p>
            <p className="mt-1.5 text-[14px] text-gray-500">새 공고가 올라오면 이곳과 채용정보에 바로 보입니다.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href={ROUTES.JOBS} className="inline-flex h-11 items-center rounded-lg border border-gray-300 px-5 text-[14px] font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary">전체 채용정보</Link>
              <Link href={ROUTES.JOBS_NEW} className="inline-flex h-11 items-center rounded-lg border border-gray-300 px-5 text-[14px] font-bold text-gray-700 transition-colors hover:border-primary hover:text-primary">공고 등록하기</Link>
            </div>
          </div>
        )}
      </section>

      {/* 자주 묻는 질문 — 넓은 화면은 두 단 */}
      <section id="faq" className="border-t border-gray-200 py-12 sm:py-14">
        <h2 className={H2}>자주 묻는 질문</h2>
        <dl className="mt-6 grid gap-x-14 lg:grid-cols-2">
          {landing.faq.map((f) => (
            <div key={f.q} className="border-t border-gray-200 py-6">
              <dt className="flex gap-2 break-keep text-[16px] font-bold leading-snug text-ink sm:text-[17px]">
                <span aria-hidden className="text-primary">Q.</span>
                {f.q}
              </dt>
              <dd className="mt-2.5 break-keep pl-7 text-[15px] leading-relaxed text-gray-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 다른 가이드 */}
      <section aria-labelledby="more-guides" className="border-t border-gray-200 py-12 sm:py-14">
        <div className="flex items-end justify-between gap-3">
          <h2 id="more-guides" className={H2}>다른 채용 가이드</h2>
          <Link href="/guide" className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-[14px] font-semibold text-gray-500 transition-colors hover:text-primary">
            전체 가이드 <ArrowIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {otherGuides.map((g) => (
            <li key={g.slug}>
              <Link href={`/guide/${g.slug}`} className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary">
                <p className="text-[16px] font-bold text-ink group-hover:text-primary">{g.eyebrow}</p>
                <p className="mt-2 line-clamp-2 break-keep text-[14px] leading-relaxed text-gray-600">{g.lead}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 시작 안내 */}
      <section className="mt-4 rounded-2xl bg-primary px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-14 lg:py-12">
        <div>
          <p className="text-[22px] font-bold sm:text-[26px]">지금 마리에에서 시작하세요</p>
          <p className="mt-2 text-[15px] text-white/80">공고 등록·지원 모두 무료입니다.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 lg:mt-0 lg:shrink-0">
          <Link href={jobsHref} className="inline-flex h-12 items-center rounded-lg bg-white px-6 text-[15px] font-bold text-primary transition-colors hover:bg-gray-100">채용 공고 보기</Link>
          <Link href={ROUTES.JOBS_NEW} className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-[15px] font-bold text-white transition-colors hover:bg-white/10">채용 공고 등록</Link>
        </div>
      </section>
    </article>
  );
}
