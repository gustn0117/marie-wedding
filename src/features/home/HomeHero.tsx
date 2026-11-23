import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

/** 메인 크리스마스 캠페인 — 자동 전환 없이 한 장만 노출한다. */
export default function HomeHero() {
  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate overflow-hidden bg-[#8b0712] text-white"
    >
      <Image
        src="/images/home/hero-christmas.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        quality={95}
        className="-z-20 object-cover object-[60%_center] sm:object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(71,0,9,0.38)_0%,rgba(71,0,9,0.14)_52%,transparent_78%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(71,0,9,0.5)_0%,rgba(71,0,9,0.18)_60%,transparent_100%)] sm:hidden"
      />

      <div className="shell-wide flex min-h-[520px] items-center pb-24 pt-24 sm:min-h-[560px] lg:min-h-[600px] lg:pb-28">
        <div className="max-w-[680px]">
          <p className="text-[13px] font-semibold tracking-[0.18em] text-[#ffe3b0] sm:text-[14px]">
            MERRY CHRISTMAS WITH MARIE
          </p>
          <h2
            id="home-hero-title"
            className="mt-4 break-keep text-[34px] font-bold leading-[1.23] tracking-[-0.04em] sm:text-[46px] lg:text-[54px]"
          >
            <span className="block">올 연말,</span>
            <span className="block">웨딩업계 채용은</span>
            <span className="block text-[#ffe3b0]">마리에와 함께</span>
          </h2>
          <p className="mt-5 break-keep text-[15px] leading-relaxed text-white/90 sm:text-[17px]">
            좋은 인재와 새로운 기회가 만나는 곳.
            <br />
            따뜻한 연말, 마리에에서 함께할 인연을 찾아보세요.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
            <Link
              href={ROUTES.JOBS}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-5 text-[14px] font-bold text-[#8b0712] transition-colors hover:bg-[#fff0d8] focus-visible:outline-white sm:px-6 sm:text-[15px]"
            >
              채용공고 둘러보기
            </Link>
            <Link
              href={ROUTES.JOBS_NEW}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/65 px-5 text-[14px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-white sm:px-6 sm:text-[15px]"
            >
              무료 공고 등록
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
