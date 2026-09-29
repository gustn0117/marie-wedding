'use client';

import { useEffect, useRef, useState, type FocusEvent, type TouchEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

interface HeroSlide {
  /** 굵게 보이는 앞말 (광고 슬라이드는 '광고' 표시로 대신한다) */
  label: string;
  /** 구분선 뒤 설명 */
  caption: string;
  title: string;
  /** 휴대폰에서 끊어 보일 제목 줄(sm 이상은 한 줄로 이어진다). 없으면 title 을 그대로 쓴다. */
  titleLines?: string[];
  cta: { label: string; href: string };
  /** public/ 기준 배경 이미지 경로. 비워두면 어두운 빗금(이미지 자리). */
  image?: string;
  /** 좁은 화면에서 인물 등 핵심 피사체가 잘리지 않도록 이미지 초점을 조절한다. */
  imageClassName?: string;
  /** 이미지별 Next 최적화 품질. 고해상도 광고 원본은 기본값보다 높게 유지한다. */
  imageQuality?: number;
  /** 유료·제휴 광고 슬라이드 — 앞말 자리에 '광고' 표시를 붙여 광고임을 밝힌다(표시광고법). */
  sponsored?: boolean;
}

const SLIDES: HeroSlide[] = [
  {
    // 광고 — 하람 채용 공고. 모바일에서는 오른쪽 인물이 잘리지 않도록 초점을 조금 옮긴다.
    label: '광고',
    caption: '예식 도우미 · 계약직',
    title: '하람 예식 컨시어지 관리 매니저 채용',
    titleLines: ['하람 예식 컨시어지', '관리 매니저 채용'],
    cta: { label: '공고 보기', href: ROUTES.JOBS_DETAIL('1abaf3ba-d448-4594-8deb-4e0e8fbf564b') },
    image: '/images/home/hero-haram-concierge-clear.webp',
    imageClassName: 'object-[75%_center] sm:object-[center_42%]',
    imageQuality: 95,
    sponsored: true,
  },
  {
    label: '인재·업체 프로필',
    caption: '함께할 파트너 찾기',
    title: '함께할 인재와 업체를 찾아보세요',
    cta: { label: '프로필 둘러보기', href: ROUTES.DIRECTORY },
    image: '/images/home/hero-profiles.webp',
  },
  {
    label: '공고 등록',
    caption: '업체 회원 무료',
    title: '채용공고, 지금 무료로 올려보세요',
    cta: { label: '공고 등록하기', href: ROUTES.JOBS_NEW },
    image: '/images/home/hero-post-job.webp',
  },
];

const AUTOPLAY_MS = 6000;
const SWIPE_MIN_PX = 50;

/**
 * 메인 상단 풀폭 배너 슬라이더.
 * - 6초 자동 넘김 · 일시정지 버튼 · 점 인디케이터 · 모바일 스와이프
 * - 마우스를 올리거나 키보드 포커스가 안에 있으면 멈춘다
 * - 움직임 줄이기 설정이면 자동 넘김 없이 시작
 */
export default function HomeHero() {
  const count = SLIDES.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);

  // index 가 바뀔 때마다 타이머를 새로 건다 — 손으로 넘긴 슬라이드도 6초를 온전히 보여준다.
  useEffect(() => {
    if (!playing || hovered || focused || count < 2) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [index, playing, hovered, focused, count]);

  const prev = () => setIndex((i) => (i - 1 + count) % count);
  const next = () => setIndex((i) => (i + 1) % count);

  const handleTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 세로 스크롤 중 살짝 옆으로 밀린 건 무시
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) next();
    else prev();
  };

  // 마우스 클릭으로 생긴 포커스는 제외 — 점을 한 번 눌렀다고 자동 넘김이 계속 멈춰 있지 않게.
  const handleFocus = (e: FocusEvent<HTMLElement>) => {
    if (e.target.matches(':focus-visible')) setFocused(true);
  };
  const handleBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="마리에 주요 안내"
      className="relative isolate overflow-hidden bg-gray-900 text-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 배경 — 같은 자리에 겹쳐 두고 투명도로 교차 전환 */}
      {SLIDES.map((s, i) => (
        <div
          key={s.title}
          aria-hidden
          className={`absolute inset-0 -z-10 transition-opacity duration-700 ease-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
        >
          {s.image ? (
            <Image
              src={s.image}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              quality={s.imageQuality}
              className={`object-cover ${s.imageClassName ?? 'object-center'}`}
            />
          ) : (
            <div className="hatch-dark absolute inset-0" />
          )}
        </div>
      ))}
      {/* 글자 가독성 — 왼쪽을 어둡게. lg 미만은 글이 화면 폭 전체에 걸쳐 밝은 사진 위에 놓이므로
          글이 놓이는 아래쪽부터 한 번 더 어둡게 깐다(흰 글씨 명암비 AA: 제목 3:1·작은 글씨 4.5:1). */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 via-black/25 via-50% to-transparent" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/50 via-50% to-transparent lg:hidden" />

      <div className="shell-wide flex h-[460px] flex-col pb-24 pt-8 sm:h-[520px] sm:pt-12 lg:h-[600px] lg:pb-32 lg:pt-[88px]">
        {/* 점 인디케이터 + 일시정지 */}
        <div className="-ml-2 flex items-center">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}번째 슬라이드: ${s.sponsored ? '광고, ' : ''}${s.title}`}
              aria-current={i === index ? 'true' : undefined}
              className="group inline-flex h-8 w-7 items-center justify-center"
            >
              <span
                className={`block h-2 w-2 rounded-full border border-white transition-colors ${
                  i === index ? 'bg-white' : 'bg-transparent group-hover:bg-white/50'
                }`}
              />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? '자동 넘김 멈춤' : '자동 넘김 재생'}
            className="inline-flex h-8 w-8 items-center justify-center text-white/90 transition-colors hover:text-white"
          >
            {playing ? (
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                <rect x="2" y="1" width="2.4" height="10" rx="0.6" />
                <rect x="7.6" y="1" width="2.4" height="10" rx="0.6" />
              </svg>
            ) : (
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                <path d="M3 1.5v9a.5.5 0 00.77.42l7-4.5a.5.5 0 000-.84l-7-4.5A.5.5 0 003 1.5z" />
              </svg>
            )}
          </button>
        </div>

        {/* 슬라이드 글 — 한 칸에 겹쳐 두어 슬라이드마다 줄 수가 달라도 높이가 튀지 않는다 */}
        <div className="mt-auto grid min-w-0 lg:mt-[92px]">
          {SLIDES.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.title}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${count}`}
                aria-hidden={!active}
                className={`min-w-0 max-w-full [grid-area:1/1] transition-[opacity,transform,visibility] duration-500 ease-out ${
                  active ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-3 opacity-0'
                }`}
              >
                <p className="flex items-center gap-2.5 text-[14px] sm:text-[16px]">
                  {s.sponsored ? (
                    <span className="rounded-sm border border-white/80 px-1.5 text-[12px] font-bold leading-5 sm:text-[13px]">
                      {s.label}
                    </span>
                  ) : (
                    <span className="font-bold">{s.label}</span>
                  )}
                  <span aria-hidden className="h-3 w-px bg-white/60" />
                  <span className="text-white/85">{s.caption}</span>
                </p>
                <h2
                  className={`mt-3 w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] text-balance break-keep text-[30px] font-bold leading-[1.25] tracking-[-0.03em] sm:mt-4 sm:w-auto sm:text-[42px] lg:text-[52px] ${
                    s.sponsored ? 'sm:max-w-[720px]' : 'sm:max-w-[900px]'
                  }`}
                >
                  {s.titleLines
                    ? s.titleLines.map((line, li) =>
                        li === 0 ? (
                          <span key={line}>{line}</span>
                        ) : (
                          <span key={line}>
                            {' '}
                            <span className="block sm:inline">{line}</span>
                          </span>
                        ),
                      )
                    : s.title}
                </h2>
                <Link href={s.cta.href} className="group mt-7 inline-flex items-center gap-3 sm:mt-9">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                  <span className="text-[15px] font-semibold text-white underline-offset-4 group-hover:underline sm:text-[16px]">
                    {s.cta.label}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
