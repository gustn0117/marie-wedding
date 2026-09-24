import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LANDINGS, getLanding } from '@/features/seo/landings';
import { getOpenJobs } from '@/features/seo/openJobs';
import { ROUTES } from '@/shared/constants';
import JobCard from '@/features/jobs/components/JobCard';
import JsonLd from '@/shared/components/JsonLd';
import { breadcrumbJsonLd, buildPageMetadata, faqJsonLd } from '@/shared/seo';

// 가이드마다 해당 업종의 최신 모집중 공고를 함께 보여주므로 매 요청 조회한다.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const LATEST_JOBS_LIMIT = 6;

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
  });
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) notFound();

  const jobs = await getOpenJobs({ businessTypes: landing.businessTypes, limit: LATEST_JOBS_LIMIT });
  const jobsHref = landing.businessTypes.length > 0
    ? `${ROUTES.JOBS}?businessType=${landing.businessTypes.join(',')}`
    : ROUTES.JOBS;
  const otherGuides = LANDINGS.filter((l) => l.slug !== landing.slug);

  return (
    <div className="mx-auto max-w-[860px] space-y-8 pb-16">
      <JsonLd data={faqJsonLd(landing.faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '채용정보', path: '/jobs' },
          { name: landing.eyebrow, path: `/guide/${landing.slug}` },
        ])}
      />

      {/* Hero */}
      <header className="border-b border-gray-200 pb-6 pt-2">
        <p className="text-sm font-bold text-primary">{landing.eyebrow}</p>
        <h1 className="mt-2 text-[26px] sm:text-[34px] font-bold leading-[1.25] tracking-tight text-ink">{landing.h1}</h1>
        <p className="mt-3 text-[15px] sm:text-base leading-relaxed text-gray-600">{landing.lead}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={jobsHref} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors">채용 공고 보기</Link>
          <Link href={ROUTES.DIRECTORY} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition-colors">인재·업체 프로필</Link>
        </div>
      </header>

      {/* Sections */}
      <div className="space-y-8">
        {landing.sections.map((sec) => (
          <section key={sec.heading}>
            <h2 className="text-lg sm:text-xl font-bold text-ink">{sec.heading}</h2>
            {sec.body.map((p, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-gray-700">{p}</p>
            ))}
            {sec.bullets && (
              <ul className="mt-3 space-y-1.5">
                {sec.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[15px] text-gray-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {/* 최신 공고 — 가이드를 읽고 바로 지원으로 이어지게 */}
      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink">지금 모집 중인 {landing.eyebrow} 공고</h2>
          <Link href={jobsHref} className="shrink-0 py-2 text-sm font-semibold text-gray-500 hover:text-primary transition-colors">
            전체 보기
          </Link>
        </div>
        {jobs.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-6 py-8 text-center">
            <p className="text-[15px] font-semibold text-gray-800">지금은 모집 중인 공고가 없어요</p>
            <p className="mt-1 text-sm text-gray-500">새 공고가 올라오면 이곳과 채용정보에 바로 보입니다.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href={ROUTES.JOBS} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition-colors">전체 채용정보</Link>
              <Link href={ROUTES.JOBS_NEW} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition-colors">공고 등록하기</Link>
            </div>
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-6">
        <h2 className="text-lg font-bold text-ink">자주 묻는 질문</h2>
        <div className="mt-4 divide-y divide-gray-200">
          {landing.faq.map((f) => (
            <div key={f.q} className="py-4 first:pt-0 last:pb-0">
              <p className="text-[15px] font-bold text-gray-900">Q. {f.q}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 다른 가이드 — 업종별 가이드끼리 서로 잇는다 */}
      <nav aria-label="다른 채용 가이드">
        <h2 className="text-base font-bold text-ink">다른 채용 가이드</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {otherGuides.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guide/${g.slug}`}
                className="inline-flex min-h-[44px] items-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
              >
                {g.eyebrow}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* CTA */}
      <section className="rounded-xl bg-primary px-6 py-8 text-center text-white">
        <p className="text-lg font-bold">지금 마리에에서 시작하세요</p>
        <p className="mt-1 text-sm text-white/80">공고 등록·지원 모두 무료입니다.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href={jobsHref} className="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary hover:bg-gray-100 transition-colors">채용 공고 보기</Link>
          <Link href={ROUTES.JOBS_NEW} className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-colors">채용 공고 등록</Link>
        </div>
      </section>
    </div>
  );
}
