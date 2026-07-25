import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LANDINGS, getLanding } from '@/features/seo/landings';
import { ROUTES } from '@/shared/constants';
import JsonLd from '@/shared/components/JsonLd';
import { absoluteUrl, breadcrumbJsonLd } from '@/shared/seo';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LANDINGS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) return { title: '가이드', robots: { index: false, follow: true } };
  const canonical = `/guide/${landing.slug}`;
  return {
    title: landing.title,
    description: landing.description,
    keywords: landing.keywords,
    alternates: { canonical },
    openGraph: { type: 'article', title: `${landing.title} | Marié`, description: landing.description, url: canonical },
    twitter: { title: landing.title, description: landing.description },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) notFound();

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: landing.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-[860px] space-y-8 pb-16">
      <JsonLd data={faqJsonLd} />
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
          <Link href={ROUTES.JOBS} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors">채용 공고 보기</Link>
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

      {/* CTA */}
      <section className="rounded-xl bg-primary px-6 py-8 text-center text-white">
        <p className="text-lg font-bold">지금 마리에에서 시작하세요</p>
        <p className="mt-1 text-sm text-white/80">공고 등록·지원 모두 무료입니다.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href={ROUTES.JOBS} className="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary hover:bg-gray-100 transition-colors">채용 공고 보기</Link>
          <Link href={ROUTES.JOBS_NEW} className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-colors">채용 공고 등록</Link>
        </div>
      </section>
    </div>
  );
}
