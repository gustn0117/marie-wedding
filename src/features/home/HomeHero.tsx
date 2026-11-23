import type { CSSProperties } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import styles from './HomeHero.module.css';

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
 * 채용 안내는 작은 앞말, '마리에와 함께'는 가장 굵은 제목으로 구분한다.
 * 글자는 처음 한 번 차례로 떠오른다. 움직임 줄이기 설정이면 처음부터 보인다(HomeHero.module.css).
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
        <div className={`${styles.content} w-full min-w-0 max-w-[880px] text-center`}>
          <div aria-hidden="true" className={`${styles.rise} ${styles.divider}`} style={rise(0)}>
            <span />
            <Sparkle className={styles.dividerStar} />
            <span />
          </div>

          <h2
            id="home-hero-title"
            className={styles.title}
          >
            <span className={`${styles.rise} ${styles.titleLead}`} style={rise(80)}>
              올 연말, 웨딩업계 채용은
            </span>{' '}
            <span className={`${styles.rise} ${styles.headline}`} style={rise(180)}>
              <span className={styles.brand}>마리에</span>
              <span className={styles.companion}>와 함께</span>
            </span>
          </h2>

          <p
            className={`${styles.rise} ${styles.description}`}
            style={rise(280)}
          >
            <span className={styles.descriptionLead}>좋은 인재와 새로운 기회가 만나는 곳.</span>{' '}
            <span className={styles.descriptionDetail}>따뜻한 연말, 마리에에서 함께할 인연을 찾아보세요.</span>
          </p>

          <div
            className={`${styles.rise} ${styles.actions}`}
            style={rise(380)}
          >
            <Link
              href={ROUTES.JOBS}
              className={`${styles.button} ${styles.buttonPrimary}`}
            >
              채용공고 둘러보기
            </Link>
            <Link
              href={ROUTES.JOBS_NEW}
              className={`${styles.button} ${styles.buttonSecondary}`}
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
