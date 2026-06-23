'use client';

import { useCallback, useEffect, useState } from 'react';

interface Props {
  images: string[];
  altPrefix?: string;
  /** 그리드 컬럼 — Tailwind class. 기본: 2/3/4 반응형 */
  gridClassName?: string;
}

/**
 * 그리드 썸네일 + 클릭 시 풀스크린 lightbox.
 * - 외부 링크 새 탭 열기 대신 모달 내 확대 표시
 * - 좌/우 화살표 + 키보드(←/→) 네비게이션
 * - Esc / 바깥 클릭 / X 버튼으로 닫기
 */
export default function GalleryLightbox({
  images,
  altPrefix = '갤러리 이미지',
  gridClassName = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2',
}: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const close = useCallback(() => setOpenIdx(null), []);
  const prev = useCallback(() => {
    setOpenIdx((idx) => (idx === null ? null : (idx - 1 + images.length) % images.length));
  }, [images.length]);
  const next = useCallback(() => {
    setOpenIdx((idx) => (idx === null ? null : (idx + 1) % images.length));
  }, [images.length]);

  useEffect(() => {
    if (openIdx === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    // 배경 스크롤 잠금
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [openIdx, close, prev, next]);

  if (images.length === 0) return null;

  return (
    <>
      <div className={gridClassName}>
        {images.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setOpenIdx(i)}
            className="aspect-square overflow-hidden rounded-lg border border-gray-200 group hover:border-ink transition-colors block"
            aria-label={`${altPrefix} ${i + 1} 확대 보기`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${altPrefix} ${i + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
      </div>

      {openIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="이미지 확대"
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          {/* 닫기 */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 인덱스 표시 */}
          {images.length > 1 && (
            <div className="absolute top-4 left-4 text-white text-sm font-bold tabular-nums bg-white/10 px-3 py-1.5 rounded-full">
              {openIdx + 1} / {images.length}
            </div>
          )}

          {/* 이전 */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label="이전 이미지"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          {/* 이미지 본체 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[openIdx]}
            alt={`${altPrefix} ${openIdx + 1}`}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />

          {/* 다음 */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={next}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label="다음 이미지"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>
      )}
    </>
  );
}
