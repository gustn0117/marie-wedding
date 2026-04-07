'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import FilterSelect from '@/shared/components/FilterSelect';

export default function CompanyFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const businessType = searchParams.get('businessType') ?? '';
  const region = searchParams.get('region') ?? '';
  const search = searchParams.get('search') ?? '';

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      // Reset to first page on filter change
      params.delete('page');

      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const value = (formData.get('search') as string).trim();
    updateParams({ search: value });
  };

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">
              검색
            </label>
            <div className="relative">
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="업체명 또는 담당자명으로 검색"
                className="input-field w-full pr-10"
              />
              <button
                type="submit"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-primary transition-colors duration-200"
                aria-label="검색"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </form>

        {/* Business Type */}
        <FilterSelect
          label="업종"
          options={BUSINESS_TYPES}
          value={businessType}
          onChange={(value) => updateParams({ businessType: value })}
        />

        {/* Region */}
        <FilterSelect
          label="지역"
          options={REGIONS}
          value={region}
          onChange={(value) => updateParams({ region: value })}
        />
      </div>
    </div>
  );
}
