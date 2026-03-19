'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import { POST_CATEGORIES } from '@/shared/constants';

const ALL_CATEGORY = { value: '', label: '전체' } as const;
const TABS = [ALL_CATEGORY, ...POST_CATEGORIES];

interface PostFiltersProps {
  onFilterChange?: (filters: { category?: string; search?: string }) => void;
}

export default function PostFilters({ onFilterChange }: PostFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get('category') ?? '';
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '');

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

      // Reset page on filter change
      params.delete('page');

      const queryString = params.toString();
      router.push(queryString ? `?${queryString}` : '?', { scroll: false });

      onFilterChange?.({
        category: params.get('category') ?? undefined,
        search: params.get('search') ?? undefined,
      });
    },
    [searchParams, router, onFilterChange],
  );

  const handleCategoryClick = (categoryValue: string) => {
    updateParams({ category: categoryValue });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchValue.trim() });
  };

  const handleSearchClear = () => {
    setSearchValue('');
    updateParams({ search: '' });
  };

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleCategoryClick(tab.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-200 -mb-px ${
              activeCategory === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
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
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="게시글 검색..."
            className="input-field pl-10 pr-10"
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button type="submit" className="btn-secondary text-sm">
          검색
        </button>
      </form>
    </div>
  );
}
