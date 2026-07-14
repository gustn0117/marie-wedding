'use client';

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';

/**
 * 외부/Supabase Storage 이미지 안정 표시.
 *  - onError 발생 시 fallback ReactNode를 보여주거나, fallback이 없으면 중립 placeholder.
 *  - 빈 src도 fallback 경로로 처리.
 *
 * 사용처: 공고 카드(FeaturedJobsCarousel·JobBoardRow), 디렉토리 프로필 카드 등.
 */
interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'src'> {
  src?: string | null;
  fallback?: ReactNode;
  wrapperClassName?: string;
}

export default function SafeImage({
  src,
  alt = '',
  className,
  fallback,
  wrapperClassName,
  ...rest
}: Props) {
  const [errored, setErrored] = useState(false);

  // 이전 URL의 로드 실패 상태가 새 이미지 URL까지 가리지 않도록 초기화한다.
  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (!src || errored) {
    return (
      <div className={wrapperClassName ?? className} aria-label={alt} role="img">
        {fallback ?? <DefaultFallback />}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
      {...rest}
    />
  );
}

function DefaultFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.4}
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
        />
      </svg>
    </div>
  );
}
