'use client';

import { useState } from 'react';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';

interface JobImageGalleryProps {
  images: string[];
}

/**
 * 공고 추가 사진 갤러리 — 썸네일 그리드 + 클릭 시 원본 라이트박스.
 * 등록자가 정한 순서를 그대로 보여준다.
 */
export default function JobImageGallery({ images }: JobImageGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const urls = images.map((p) => resolveStorageUrl(p, 'job-images')).filter((u): u is string => !!u);
  if (urls.length === 0) return null;

  const close = () => setOpenIndex(null);
  const step = (dir: -1 | 1) => {
    setOpenIndex((cur) => (cur === null ? cur : (cur + dir + urls.length) % urls.length));
  };

  return (
    <section className="rounded-xl bg-white border border-gray-200 p-6 md:p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-5 pb-3 border-b border-gray-200">
        사진 <span className="ml-1 text-sm font-normal text-gray-400">{urls.length}장</span>
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="group aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
            aria-label={`사진 ${i + 1} 크게 보기`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`공고 사진 ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="사진 크게 보기"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[openIndex]}
            alt={`공고 사진 ${openIndex + 1}`}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/25"
          >
            닫기
          </button>
          {urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                aria-label="이전 사진"
                className="absolute left-3 rounded-full bg-white/15 px-3 py-2 text-lg font-bold text-white hover:bg-white/25"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(1); }}
                aria-label="다음 사진"
                className="absolute right-3 rounded-full bg-white/15 px-3 py-2 text-lg font-bold text-white hover:bg-white/25"
              >
                ›
              </button>
              <span className="absolute bottom-5 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white tabular-nums">
                {openIndex + 1} / {urls.length}
              </span>
            </>
          )}
        </div>
      )}
    </section>
  );
}
