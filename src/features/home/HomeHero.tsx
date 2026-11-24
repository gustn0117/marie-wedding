import type { CSSProperties } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import heroWide from './images/hero-christmas-centered-4k.webp';
import heroMobile from './images/hero-christmas-centered-mobile.webp';
import styles from './HomeHero.module.css';

/** 떠오르는 순서(ms) */
const rise = (delay: number) => ({ '--rise-delay': `${delay}ms` }) as CSSProperties;

// 배경: PC용 3840×1600(1942×809 원본을 고품질 확대)과 모바일 전용 1024×1536.
// - 파일을 import 하면 주소에 내용 해시가 붙는다(/_next/static/media/…). 그래서 변환본도 '바뀌지 않는 파일'
//   (max-age 10년, immutable)로 나가 서버·브라우저가 계속 다시 쓰고, 사진을 바꾸면 주소가 바뀌어 옛 사진이 남지 않는다.
//   public/ 주소로 두면 변환본 수명이 60초라 1분마다 다시 변환한다. 사진을 바꿀 때는 images/ 의 파일만 갈아 끼우면 된다.
// - 품질 80: 95와 레티나·휴대폰 화면을 확대해 비교해도 차이가 보이지 않는데 용량은 절반 남짓이다
//   (실제 응답 기준 PC 3840폭 1.22MB→0.57MB, 1920폭 470KB→251KB, 휴대폰 395KB→206KB).
// - PC는 높이 660px을 덮을 때 최소 1584px 폭으로 그려지므로, Retina에서도 작은 이미지를 늘리지 않게 크기를 알린다.
const heroImage = { alt: '', fill: true, quality: 80, fetchPriority: 'high', loading: 'eager' } as const;
const {
  props: { srcSet: wideSrcSet, ...wideImgProps },
} = getImageProps({
  ...heroImage,
  src: heroWide,
  sizes: '(max-width: 1584px) 1584px, 100vw',
});
const {
  props: { srcSet: mobileSrcSet },
} = getImageProps({
  ...heroImage,
  src: heroMobile,
  sizes: '(max-width: 400px) 400px, 100vw',
});

// 사진이 오기 전 자리 — 빌드 때 만든 몇 픽셀짜리 미리보기를 깔아, 빈 빨강 대신 장면의 색 배치가 먼저 보인다.
const preview = {
  '--hero-preview-wide': `url("${heroWide.blurDataURL}")`,
  '--hero-preview-mobile': `url("${heroMobile.blurDataURL}")`,
} as CSSProperties;

/**
 * 메인 크리스마스 캠페인 — 자동 전환 없이 한 장만 노출한다.
 *
 * 배치: 글자와 버튼은 배경 중앙의 빈 루비색 자리에 정렬하고, 위 장식 띠 아래부터 바로가기 칸(HomeQuickLinks 가
 * -mt-12 / sm:-mt-16 으로 겹쳐 올라옴) 위까지의 한가운데에 온다 — 위 여백은 장식 띠 높이, 아래 여백은 겹치는 높이.
 * 비율: 1584px 넘는 화면은 히어로 높이를 PC 사진 비율(2.4:1)대로 늘려 사진이 잘리지 않게 하고,
 * 글자·버튼도 같은 배율로 키워(HomeHero.module.css 의 .content 글자 크기 기준 em) 어느 폭에서나 같은 구도로 보인다.
 * 색: 금색은 앞말 '올 연말, 웨딩업계 채용은'에만, 제목 '마리에와 함께'와 나머지는 흰색 계열.
 * 글자는 처음 한 번 차례로 떠오르고, 다 떠오르면 금빛 앞말 위로 빛이 한 번 스친다.
 * 움직임 줄이기 설정이면 처음부터 멈춘 채 보인다.
 */
export default function HomeHero() {
  return (
    <section
      aria-labelledby="home-hero-title"
      className={`${styles.hero} relative isolate overflow-hidden text-white`}
      style={preview}
    >
      <picture>
        <source media="(max-width: 639px)" srcSet={mobileSrcSet} sizes="(max-width: 400px) 400px, 100vw" />
        {/* next/image 가 만든 주소·크기 그대로(getImageProps) — 화면 폭에 따라 사진을 바꾸려고 <picture> 로 감쌌다. */}
        {/* 아주 넓은 화면(1584px 초과)은 사진 위아래가 잘리는데, 위를 맞춰 금빛 아치를 온전히 남기고 바로가기 칸에 가리는 아래를 덜어 낸다. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          {...wideImgProps}
          srcSet={wideSrcSet}
          className="-z-20 object-cover object-center sm:object-top"
        />
      </picture>
      <div aria-hidden="true" className={`absolute inset-0 -z-10 ${styles.scrim}`} />

      {/* 높이: 1584px 넘는 화면은 폭 ÷ 2.4(= 41.667vw) — PC 사진 비율 그대로라 위아래가 잘리지 않는다.
          위 여백 = 사진의 아치 높이: 휴대폰 사진은 약 65px, PC 사진은 그려진 높이의 16%(1584px 넘으면 6.67vw).
          아래 여백 = 바로가기 칸이 겹쳐 올라오는 높이. */}
      <div className="shell-wide flex min-h-[600px] items-center justify-center pb-12 pt-[68px] sm:min-h-[640px] sm:pb-16 sm:pt-24 lg:min-h-[max(660px,41.667vw)] lg:pt-[max(106px,6.67vw)]">
        <div className={`${styles.content} w-full min-w-0 text-center`}>
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
              <span className={styles.gold}>올 연말, 웨딩업계 채용은</span>
            </span>{' '}
            <span className={`${styles.rise} ${styles.headline}`} style={rise(180)}>
              마리에와 함께
            </span>
          </h2>

          <p
            className={`${styles.rise} ${styles.description}`}
            style={rise(280)}
          >
            <span className={styles.descriptionLead}>좋은 인재와 새로운 기회가 만나는 곳.</span>{' '}
            <span className={styles.descriptionDetail}>따뜻한 연말, 마리에에서 함께할 인연을 찾아보세요.</span>
          </p>

          {/* 떠오르기는 버튼 하나하나에 건다 — 묶음에 걸면 그동안 묶음이 따로 그려져 둘째 버튼의 뒤 흐림이 사진을 못 본다. */}
          <div className={styles.actions}>
            <Link
              href={ROUTES.JOBS}
              className={`${styles.rise} ${styles.button} ${styles.buttonPrimary}`}
              style={rise(380)}
            >
              채용공고 둘러보기
            </Link>
            <Link
              href={ROUTES.JOBS_NEW}
              className={`${styles.rise} ${styles.button} ${styles.buttonSecondary}`}
              style={rise(430)}
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
