'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '인기순' },
] as const;

export default function PostFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeSort = searchParams.get('sort') ?? 'latest';
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '');

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      params.delete('page');
      const queryString = params.toString();
      router.push(queryString ? `?${queryString}` : '?', { scroll: false });
    },
    [searchParams, router],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchValue.trim() });
  };

  const handleSearchClear = () => {
    setSearchValue('');
    updateParams({ search: '' });
  };

  return (
    <div className="platform-filter-dock">
      {/* Search + Sort */}
      <div className="flex items-center gap-3 p-3 flex-wrap bg-white">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 min-w-[200px]">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="게시글 검색"
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
            />
            {searchValue && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button type="submit" className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded hover:bg-primary-dark transition-colors">
            검색
          </button>
        </form>

        {/* Sort Pills */}
        <div className="flex gap-1 shrink-0">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParams({ sort: opt.value === 'latest' ? '' : opt.value })}
              className={`px-3 py-2 text-xs font-bold rounded transition-colors ${
                activeSort === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
