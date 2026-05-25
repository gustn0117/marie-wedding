'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BUSINESS_TYPES, REGIONS } from '@/shared/constants';

export default function CompanyFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const businessType = searchParams.get('businessType') ?? '';
  const region = searchParams.get('region') ?? '';
  const search = searchParams.get('search') ?? '';

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      params.delete('page');
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateParams({ search: ((formData.get('search') as string) ?? '').trim() });
  };

  const resetAll = () => router.push('/directory', { scroll: false });

  return (
    <aside className="platform-filter-dock divide-y divide-gray-100 sticky-sidebar">
      {/* 검색 */}
      <div className="p-3">
        <form onSubmit={handleSearch}>
          <label className="mb-1.5 block text-micro font-bold text-gray-700">검색</label>
          <div className="relative">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="업체명·담당자"
            className="input-field pr-8"
            />
            <button
              type="submit"
              aria-label="검색"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* 업종 */}
      <div className="p-3">
        <h3 className="mb-1.5 text-micro font-bold text-gray-700">업종</h3>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => updateParams({ businessType: '' })}
            className={`text-left text-small py-1.5 px-2 rounded font-semibold transition-colors ${
              !businessType ? 'bg-primary-50 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            전체
          </button>
          {BUSINESS_TYPES.map((b) => (
            <button
              key={b.value}
              onClick={() => updateParams({ businessType: b.value })}
              className={`text-left text-small py-1.5 px-2 rounded font-semibold transition-colors ${
                businessType === b.value
                  ? 'bg-primary-50 text-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 지역 */}
      <div className="p-3">
        <h3 className="mb-1.5 text-micro font-bold text-gray-700">지역</h3>
        <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
          <button
            onClick={() => updateParams({ region: '' })}
            className={`text-left text-small py-1.5 px-2 rounded font-semibold transition-colors ${
              !region ? 'bg-primary-50 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            전국
          </button>
          {REGIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => updateParams({ region: r.value })}
              className={`text-left text-small py-1.5 px-2 rounded font-semibold transition-colors ${
                region === r.value
                  ? 'bg-primary-50 text-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={resetAll}
          className="w-full text-micro font-semibold text-gray-500 hover:text-gray-700 py-2 border border-gray-200 rounded hover:border-gray-400 transition-colors"
        >
          필터 초기화
        </button>
      </div>
    </aside>
  );
}
