'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface AppSearchFieldProps {
  placeholder: string;
  /** 주소에 실을 검색어 이름(목록 화면은 search, 통합 검색은 q) */
  paramKey?: string;
  /** 검색할 화면 주소 — 없으면 지금 화면 */
  basePath?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * 앱 검색칸(.app-only) — 둥근 회색 칸, 키보드의 '검색'을 누르면 바로 찾는다(따로 검색 버튼 없음).
 * 검색어는 주소(?search=)에 실려 뒤로 가기·새로고침에도 남는다. 다른 필터는 그대로 두고 쪽 번호만 지운다.
 */
export default function AppSearchField({
  placeholder,
  paramKey = 'search',
  basePath,
  autoFocus = false,
  className = '',
}: AppSearchFieldProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? '';
  const [value, setValue] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  // 뒤로 가기 등으로 주소의 검색어가 바뀌면 칸도 따라간다
  useEffect(() => {
    setValue(current);
  }, [current]);

  const go = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (next) params.set(paramKey, next);
    else params.delete(paramKey);
    const qs = params.toString();
    router.push(`${basePath ?? pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <form
      role="search"
      className={`app-only ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        inputRef.current?.blur(); // 키보드 내리기
        go(value.trim());
      }}
    >
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="app-search-input h-10 w-full appearance-none rounded-xl border-0 bg-gray-100 pl-10 pr-10 text-[16px] text-ink placeholder:text-gray-400 focus:outline-none focus-visible:outline-none"
        />
        {value && (
          <button
            type="button"
            aria-label="검색어 지우기"
            data-haptic="none"
            onClick={() => {
              setValue('');
              if (current) go('');
              inputRef.current?.focus();
            }}
            className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-gray-400"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
