import type { CSSProperties } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import localFont from 'next/font/local';
import { ROUTES } from '@/shared/constants';
import styles from './HomeHero.module.css';

// 'Merry Christmas' 금박 글씨 — Cormorant Garamond Italic(OFL, fonts/OFL.txt).
// 기본 영문 글자만 남긴 가변 분할본(18KB)이라 메인에서만 받는다. 글꼴이 오기 전에는 비슷한 크기의 기본 세리프로 보인다.
const foilFont = localFont({
  src: './fonts/cormorant-garamond-italic-latin.woff2',
  weight: '300 700',
  style: 'italic',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

/** 떠오르는 순서(ms) */
const rise = (delay: number) => ({ '--rise-delay': `${delay}ms` }) as CSSProperties;

// 배경: PC용 3840×1600(고품질 리샘플링)과 모바일 전용 1024×1536.
// PC는 높이 660px을 덮을 때 최소 1584px 폭으로 그려지므로, Retina에서도 작은 이미지를 늘리지 않게 크기를 알린다.
// 모바일은 세로로 제작한 별도 사진을 받아 양옆 장식과 중앙 여백을 함께 보존한다.
const heroImage = { alt: '', fill: true, quality: 95, fetchPriority: 'high', loading: 'eager' } as const;
const {
  props: { srcSet: wideSrcSet, ...wideImgProps },
} = getImageProps({
  ...heroImage,
  src: '/images/home/hero-christmas-centered-4k.webp',
  sizes: '(max-width: 1584px) 1584px, 100vw',
});
const {
  props: { srcSet: mobileSrcSet },
} = getImageProps({
  ...heroImage,
  src: '/images/home/hero-christmas-centered-mobile.webp',
  sizes: '(max-width: 400px) 400px, 100vw',
});

/**
 * 메인 크리스마스 캠페인 — 자동 전환 없이 한 장만 노출한다.
 *
 * 배치: 글자와 버튼은 배경 중앙의 빈 루비색 자리에 정렬하고, 위 장식 띠 아래부터 바로가기 칸(HomeQuickLinks 가
 * -mt-12 / sm:-mt-16 으로 겹쳐 올라옴) 위까지의 한가운데에 온다 — 위 여백은 장식 띠 높이, 아래 여백은 겹치는 높이.
 * 글자 크기는 금박 글씨 → 제목 → 설명 → 버튼 순으로 한 단계씩 줄어든다.
 * 효과는 한 곳에 모은다: 청첩장 금박 같은 'Merry Christmas' 위로 빛이 스치고 작은 별이 반짝인다.
 * 나머지 글자는 처음 한 번 차례로 떠오른다. 움직임 줄이기 설정이면 모두 멈춘 채 보인다(HomeHero.module.css).
 */
export default function HomeHero() {
  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate overflow-hidden bg-[#7a0a14] text-white"
    >
      <picture>
        <source media="(max-width: 639px)" srcSet={mobileSrcSet} sizes="(max-width: 400px) 400px, 100vw" />
        {/* next/image 가 만든 주소·크기 그대로(getImageProps) — 화면 폭에 따라 사진을 바꾸려고 <picture> 로 감쌌다. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          {...wideImgProps}
          srcSet={wideSrcSet}
          className="-z-20 object-cover object-center"
        />
      </picture>
      <div aria-hidden="true" className={`absolute inset-0 -z-10 ${styles.scrim}`} />

      <div className="shell-wide flex min-h-[600px] items-center justify-center pb-12 pt-[100px] sm:min-h-[640px] sm:pb-16 sm:pt-24 lg:min-h-[660px] lg:pt-[106px]">
        <div className="w-full min-w-0 max-w-[880px] text-center">
          <p
            lang="en"
            className={`${styles.rise} ${foilFont.className} text-[46px] font-semibold leading-none tracking-[-0.005em] sm:text-[58px] lg:text-[70px] xl:text-[76px]`}
            style={rise(0)}
          >
            <span className={styles.foilLine}>
              <span className={styles.foil}>Merry Christmas</span>
              <Sparkle className={`${styles.sparkle} ${styles.sparkleA}`} />
              <Sparkle className={`${styles.sparkle} ${styles.sparkleB}`} />
              <Sparkle className={`${styles.sparkle} ${styles.sparkleC}`} />
            </span>
          </p>

          <h2
            id="home-hero-title"
            className="mt-3 break-keep text-[31px] font-bold leading-[1.25] tracking-[-0.025em] text-[#fff8f1] [text-shadow:0_2px_22px_rgba(52,0,6,0.4)] sm:mt-4 sm:text-[42px] lg:text-[50px] xl:text-[54px]"
          >
            {/* 넓은 화면은 두 줄(올 연말, 웨딩업계 채용은 / 마리에와 함께), 좁은 화면은 뜻 단위 세 줄 */}
            <span className={`${styles.rise} block lg:inline-block`} style={rise(110)}>
              올 연말,
            </span>{' '}
            <span className={`${styles.rise} block lg:inline-block`} style={rise(190)}>
              웨딩업계 채용은
            </span>{' '}
            <span className={`${styles.rise} block`} style={rise(270)}>
              마리에와 함께
            </span>
          </h2>

          <p
            className={`${styles.rise} mx-auto mt-5 max-w-[34rem] break-keep text-[15.5px] leading-[1.75] text-[#fff3ea]/[0.88] [text-wrap:pretty] sm:text-[17px] lg:mt-6 lg:text-[18px]`}
            style={rise(380)}
          >
            좋은 인재와 새로운 기회가 만나는 곳.
            <br />
            따뜻한 연말, 마리에에서 함께할 인연을 찾아보세요.
          </p>

          <div
            className={`${styles.rise} mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 lg:mt-9`}
            style={rise(480)}
          >
            <Link
              href={ROUTES.JOBS}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#fff8f1] px-6 text-[15px] font-bold text-[#7a0a14] shadow-[0_12px_32px_-14px_rgba(40,0,6,0.7)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe3b0] lg:min-h-[52px] lg:px-7 lg:text-[16px]"
            >
              채용공고 둘러보기
            </Link>
            <Link
              href={ROUTES.JOBS_NEW}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#f3d9a4]/70 px-6 text-[15px] font-semibold text-[#fff8f1] transition-colors hover:border-[#f3d9a4] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe3b0] lg:min-h-[52px] lg:px-7 lg:text-[16px]"
            >
              무료 공고 등록
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 네 갈래 반짝임 별 */
function Sparkle({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0C12.7 6.4 17.6 11.3 24 12 17.6 12.7 12.7 17.6 12 24 11.3 17.6 6.4 12.7 0 12 6.4 11.3 11.3 6.4 12 0Z" />
    </svg>
  );
}
