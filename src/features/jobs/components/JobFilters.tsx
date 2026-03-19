'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BUSINESS_TYPES, EMPLOYMENT_TYPES, REGIONS } from '@/shared/constants';
import FilterSelect from '@/shared/components/FilterSelect';

export default function JobFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [businessType, setBusinessType] = useState(searchParams.get('businessType') ?? '');
  const [employmentType, setEmploymentType] = useState(searchParams.get('employmentType') ?? '');
  const [region, setRegion] = useState(searchParams.get('region') ?? '');

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset page when filters change
      params.delete('page');

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Sync select filters immediately
  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setBusinessType(searchParams.get('businessType') ?? '');
    setEmploymentType(searchParams.get('employmentType') ?? '');
    setRegion(searchParams.get('region') ?? '');
  }, [searchParams]);

  // Debounced search
  useEffect(() => {
    const currentSearch = searchParams.get('search') ?? '';
    if (search === currentSearch) return;

    const timer = setTimeout(() => {
      updateParams({ search });
    }, 400);

    return () => clearTimeout(timer);
  }, [search, searchParams, updateParams]);

  const handleSelectChange = (key: string) => (value: string) => {
    updateParams({ [key]: value });
  };

  const hasActiveFilters = businessType || employmentType || region || search;

  const handleReset = () => {
    setSearch('');
    router.push('?');
  };

  return (
    <div className="card p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
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
        <input
          type="text"
          placeholder="공고 제목으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10 w-full"
        />
      </div>

      {/* Filter Selects */}
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="업종"
          options={BUSINESS_TYPES}
          value={businessType}
          onChange={handleSelectChange('businessType')}
        />
        <FilterSelect
          label="고용형태"
          options={EMPLOYMENT_TYPES}
          value={employmentType}
          onChange={handleSelectChange('employmentType')}
        />
        <FilterSelect
          label="지역"
          options={REGIONS}
          value={region}
          onChange={handleSelectChange('region')}
        />

        {/* Reset */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={handleReset}
              className="px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
