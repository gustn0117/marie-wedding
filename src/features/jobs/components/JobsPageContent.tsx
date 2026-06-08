'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Job } from '@/types/database';
import { BUSINESS_TYPES, EMPLOYMENT_TYPES, REGIONS, ROUTES } from '@/shared/constants';
import { REGION_DETAILS } from '@/shared/constants/regions';
import {
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import FilterChip from '@/shared/components/FilterChip';
import ViewToggle, { type ViewMode } from '@/shared/components/ViewToggle';
import JobListRow from './JobListRow';
import JobCard from './JobCard';
import SaveSearchButton from '@/features/saved-searches/components/SaveSearchButton';

const PAGE_SIZE = 20;

interface JobsPageContentProps {
  initialJobs?: Job[];
  initialCount?: number;
}

export default function JobsPageContent({ initialJobs, initialCount }: JobsPageContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRegion, setSelectedRegion] = useState(searchParams.get('region') ?? '');
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>(() => {
    const bt = searchParams.get('businessType');
    return bt ? bt.split(',') : [];
  });
  const [selectedEmploymentType, setSelectedEmploymentType] = useState(searchParams.get('employmentType') ?? '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [businessTypeDropdownOpen, setBusinessTypeDropdownOpen] = useState(false);
  const [employmentTypeDropdownOpen, setEmploymentTypeDropdownOpen] = useState(false);
  const [browsingRegion, setBrowsingRegion] = useState('');
  const [selectedSubRegions, setSelectedSubRegions] = useState<string[]>(() => {
    const sub = searchParams.get('subRegion');
    return sub ? sub.split(',') : [];
  });
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const verifiedOnly = searchParams.get('verified') === '1';
  const completedOnly = searchParams.get('completed') === '1';

  const jobs = initialJobs ?? [];
  const totalCount = initialCount ?? 0;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = Number(searchParams.get('page')) || 1;

  const postingType = searchParams.get('type') ?? 'hiring';

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleRegionBrowse = (value: string) => {
    if (value !== selectedRegion) {
      setSelectedSubRegions([]);
    }
    setSelectedRegion(value);
    updateParams({ region: value, subRegion: '' });
    if (value && REGION_DETAILS[value]) {
      setBrowsingRegion(value);
    } else {
      setRegionDropdownOpen(false);
      setBrowsingRegion('');
    }
  };

  const handleRegionConfirm = (value: string) => {
    setSelectedRegion(value);
    setSelectedSubRegions([]);
    updateParams({ region: value, subRegion: '' });
    setRegionDropdownOpen(false);
    setBrowsingRegion('');
  };

  const handleSubRegionToggle = (subValue: string) => {
    setSelectedSubRegions((prev) => {
      const next = prev.includes(subValue)
        ? prev.filter((v) => v !== subValue)
        : [...prev, subValue];
      updateParams({ subRegion: next.join(',') });
      return next;
    });
  };

  const handleBusinessTypeToggle = (value: string) => {
    setSelectedBusinessTypes((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      updateParams({ businessType: next.join(',') });
      return next;
    });
  };

  const handleEmploymentTypeSelect = (value: string) => {
    setSelectedEmploymentType(value);
    updateParams({ employmentType: value });
    setEmploymentTypeDropdownOpen(false);
  };

  const closeAllDropdowns = () => {
    setRegionDropdownOpen(false);
    setBusinessTypeDropdownOpen(false);
    setEmploymentTypeDropdownOpen(false);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`?${params.toString()}`);
  };

  const getRegionFilterLabel = () => {
    if (!selectedRegion) return null;
    const regionName = getRegionLabel(selectedRegion);
    if (selectedSubRegions.length === 0) return regionName;
    const details = REGION_DETAILS[selectedRegion];
    if (!details) return regionName;
    const subLabels = selectedSubRegions
      .map((v) => details.find((d) => d.value === v)?.label)
      .filter(Boolean);
    return `${regionName} · ${subLabels.join(', ')}`;
  };

  const activeFilters = [
    selectedRegion && { key: 'region', label: getRegionFilterLabel()! },
    selectedBusinessTypes.length > 0 && {
      key: 'businessType',
      label: selectedBusinessTypes.map((v) => getBusinessTypeLabel(v)).join(', '),
    },
    selectedEmploymentType && {
      key: 'employmentType',
      label: getEmploymentTypeLabel(selectedEmploymentType),
    },
  ].filter(Boolean) as { key: string; label: string }[];

  const handleRemoveFilter = (key: string) => {
    if (key === 'region') {
      setSelectedSubRegions([]);
      updateParams({ region: '', subRegion: '' });
    } else if (key === 'businessType') {
      setSelectedBusinessTypes([]);
      updateParams({ businessType: '' });
    } else {
      updateParams({ [key]: '' });
    }
  };

  const handleResetAll = () => {
    setSearch('');
    setSelectedRegion('');
    setSelectedBusinessTypes([]);
    setSelectedEmploymentType('');
    setSelectedSubRegions([]);
    router.push('/jobs', { scroll: false });
  };


  const browsingRegionDetails = browsingRegion ? REGION_DETAILS[browsingRegion] : null;
  const pageTitle = postingType === 'matching' ? '파트너 섭외' : '채용정보';
  const selectedFilterCount = activeFilters.length + (search.trim() ? 1 : 0);

  return (
    <div className="space-y-4">
      <section className="platform-hero">
        <div className="platform-hero-grid">
          <div className="platform-hero-copy">
            <div>
            <p className="platform-eyebrow">채용 정보</p>
            <h1 className="platform-hero-title">{pageTitle}</h1>
            <p className="platform-hero-text">
              웨딩 업계 직무, 지역, 고용형태별 공고를 한 화면에서 비교하고 지원 흐름까지 이어갑니다.
            </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <HeaderMetric label="전체 결과" value={`${totalCount.toLocaleString()}건`} />
              <HeaderMetric label="선택 조건" value={`${selectedFilterCount.toLocaleString()}개`} />
              <HeaderMetric label="보기 방식" value={viewMode === 'list' ? '리스트' : '카드'} />
            </div>
          </div>
          <div className="platform-panel-soft grid content-start gap-2 p-3">
            <div className="grid grid-cols-2 gap-2">
            <Link
              href={`${ROUTES.JOBS}?type=hiring`}
              className={`rounded border px-4 py-3 text-center text-sm font-bold transition-colors ${
                postingType === 'hiring' ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary'
              }`}
            >
              채용정보
            </Link>
            <Link
              href={`${ROUTES.JOBS}?type=matching`}
              className={`rounded border px-4 py-3 text-center text-sm font-bold transition-colors ${
                postingType === 'matching' ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary'
              }`}
            >
              파트너 섭외
            </Link>
            </div>
            <Link href={ROUTES.JOBS_NEW} className="btn-primary min-h-[46px]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              공고 등록
            </Link>
          </div>
        </div>
      </section>

      {/* Filter Section */}
      <div className="platform-filter-dock">
        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-gray-100 bg-white">
          {/* Region Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                const opening = !regionDropdownOpen;
                closeAllDropdowns();
                setRegionDropdownOpen(opening);
                if (opening) setBrowsingRegion(selectedRegion);
              }}
              className={`flex items-center gap-2 px-3 py-2 bg-white border rounded text-small font-semibold transition-colors ${
                regionDropdownOpen
                  ? 'border-ink ring-2 ring-ink/10'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span>
                {selectedRegion
                  ? selectedSubRegions.length > 0
                    ? `지역 · ${getRegionLabel(selectedRegion)}(${selectedSubRegions.length})`
                    : `지역 · ${getRegionLabel(selectedRegion)}`
                  : '지역 선택'}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${regionDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Business Type Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                const opening = !businessTypeDropdownOpen;
                closeAllDropdowns();
                setBusinessTypeDropdownOpen(opening);
              }}
              className={`flex items-center gap-2 px-3 py-2 bg-white border rounded text-small font-semibold transition-colors ${
                businessTypeDropdownOpen
                  ? 'border-ink ring-2 ring-ink/10'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
              <span>
                {selectedBusinessTypes.length > 0
                  ? `업종 · ${selectedBusinessTypes.length}개`
                  : '업종 선택'}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${businessTypeDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Employment Type Dropdown */}
          {postingType === 'hiring' && (
            <div className="relative">
              <button
                onClick={() => {
                  const opening = !employmentTypeDropdownOpen;
                  closeAllDropdowns();
                  setEmploymentTypeDropdownOpen(opening);
                }}
                className={`flex items-center gap-2 px-3 py-2 bg-white border rounded text-small font-semibold transition-colors ${
                  employmentTypeDropdownOpen
                    ? 'border-ink ring-2 ring-ink/10'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <span>
                  {selectedEmploymentType
                    ? `고용 · ${getEmploymentTypeLabel(selectedEmploymentType)}`
                    : '고용형태'}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${employmentTypeDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 flex gap-2 min-w-[200px]">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="검색어 입력"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateParams({ search });
                }}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded text-small focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary"
              />
            </div>
            <button
              onClick={() => updateParams({ search })}
              className="px-4 py-2 bg-primary text-white text-small font-bold rounded hover:bg-primary-dark transition-colors shrink-0"
            >
              검색
            </button>
          </div>
        </div>

        {/* Region Dropdown Panel */}
        {regionDropdownOpen && (
          <div className="border-b border-gray-200 bg-white">
            <div className="flex">
              <div className="w-[200px] border-r border-gray-200 max-h-[360px] overflow-y-auto">
                <button
                  onClick={() => handleRegionConfirm('')}
                  className={`w-full text-left px-4 py-2 text-small hover:bg-gray-50 transition-colors ${
                    !browsingRegion ? 'bg-primary-50 text-primary font-semibold' : 'text-gray-700'
                  }`}
                >
                  전체
                </button>
                {REGIONS.map((r) => {
                  const hasDetails = !!REGION_DETAILS[r.value];
                  return (
                    <button
                      key={r.value}
                      onClick={() =>
                        hasDetails ? handleRegionBrowse(r.value) : handleRegionConfirm(r.value)
                      }
                    className={`w-full text-left px-4 py-2 text-small hover:bg-primary-50/50 transition-colors flex items-center justify-between ${
                        browsingRegion === r.value
                          ? 'bg-primary-50 text-primary font-semibold'
                          : 'text-gray-700'
                      }`}
                    >
                      <span>{r.label}</span>
                      {hasDetails && (
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {browsingRegionDetails && (
                <div className="flex-1 p-4 max-h-[360px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => handleRegionConfirm(browsingRegion)}
                      className="text-small font-semibold text-primary hover:underline"
                    >
                      {getRegionLabel(browsingRegion)} 전체 선택
                    </button>
                    <button
                      onClick={() => setRegionDropdownOpen(false)}
                      className="text-micro text-gray-400 hover:text-gray-600"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5">
                    {browsingRegionDetails.map((detail) => (
                      <label
                        key={detail.value}
                        className="flex items-center gap-2 px-2 py-1.5 text-small text-gray-600 hover:text-gray-900 cursor-pointer rounded hover:bg-primary-50/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubRegions.includes(detail.value)}
                          onChange={() => handleSubRegionToggle(detail.value)}
                          className="w-3.5 h-3.5 rounded-sm border-gray-300 text-primary focus:ring-primary/30"
                        />
                        <span>{detail.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Business Type Dropdown Panel */}
        {businessTypeDropdownOpen && (
          <div className="border-b border-gray-200 bg-white px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  setSelectedBusinessTypes([]);
                  updateParams({ businessType: '' });
                }}
                className={`px-3 py-1.5 rounded text-small font-semibold transition-colors ${
                  selectedBusinessTypes.length === 0
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {BUSINESS_TYPES.map((bt) => {
                const selected = selectedBusinessTypes.includes(bt.value);
                return (
                  <button
                    key={bt.value}
                    onClick={() => handleBusinessTypeToggle(bt.value)}
                    className={`px-3 py-1.5 rounded text-small font-semibold transition-colors flex items-center gap-1 ${
                      selected
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {selected && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                    {bt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Employment Type Dropdown Panel */}
        {postingType === 'hiring' && employmentTypeDropdownOpen && (
          <div className="border-b border-gray-200 bg-white px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleEmploymentTypeSelect('')}
                className={`px-3 py-1.5 rounded text-small font-semibold transition-colors ${
                  !selectedEmploymentType
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {EMPLOYMENT_TYPES.map((et) => (
                <button
                  key={et.value}
                  onClick={() => handleEmploymentTypeSelect(et.value)}
                  className={`px-3 py-1.5 rounded text-small font-semibold transition-colors ${
                    selectedEmploymentType === et.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {et.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trust + salary + experience filter toggles */}
      <div className="platform-panel-soft flex items-center gap-2 px-4 py-3 flex-wrap">
        <button
          type="button"
          onClick={() => updateParams({ verified: verifiedOnly ? '' : '1' })}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border transition-colors ${
            verifiedOnly ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary'
          }`}
        >
          ✓ 인증 업체만
        </button>
        <button
          type="button"
          onClick={() => updateParams({ completed: completedOnly ? '' : '1' })}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border transition-colors ${
            completedOnly ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary'
          }`}
        >
          거래 이력 있음
        </button>

        <SalaryFilterChip value={searchParams.get('salaryMin') ?? ''} onChange={(v) => updateParams({ salaryMin: v })} />
        <ExperienceFilterChip value={searchParams.get('expMax') ?? ''} onChange={(v) => updateParams({ expMax: v })} />

        {activeFilters.map((f) => (
          <FilterChip key={f.key} label={f.label} onRemove={() => handleRemoveFilter(f.key)} />
        ))}
        {(activeFilters.length > 0 || verifiedOnly || completedOnly || search.trim() || searchParams.get('salaryMin') || searchParams.get('expMax')) && (
          <button
            onClick={handleResetAll}
            className="ml-auto text-micro text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline"
          >
            전체 초기화
          </button>
        )}
      </div>

      {/* Results Info + View Toggle */}
      <div className="platform-toolbar">
        <p className="text-sm font-semibold text-gray-600" aria-live="polite">
          검색 결과 <span className="font-bold text-primary">{totalCount.toLocaleString()}</span>건
          <span className="ml-2 text-xs font-medium text-gray-400">최신 등록순</span>
        </p>
        <div className="flex items-center gap-3">
          <SaveSearchButton
            scope="jobs"
            query={{
              search,
              region: selectedRegion,
              businessType: selectedBusinessTypes.join(','),
              employmentType: selectedEmploymentType,
              subRegion: selectedSubRegions.join(','),
              type: postingType,
            }}
            defaultName={search || getRegionFilterLabel() || (postingType === 'matching' ? '업체 섭외' : '공고 검색')}
          />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Results */}
      {jobs.length === 0 ? (
        <div className="platform-panel p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </div>
          <h3 className="text-h4 font-semibold text-gray-900 mb-1">등록된 채용 공고가 없습니다</h3>
          <p className="text-small text-gray-500 mb-4">조건에 맞는 채용 공고가 없습니다.</p>
          <Link href={ROUTES.JOBS_NEW} className="btn-primary inline-block">
            공고 등록하기
          </Link>
        </div>
      ) : viewMode === 'list' ? (
        <div className="platform-data-table">
          {jobs.map((job) => (
            <JobListRow key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-6">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="이전 페이지"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={`w-8 h-8 flex items-center justify-center rounded-sm text-small ${
                page === currentPage
                  ? 'bg-primary text-white font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="다음 페이지"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function SalaryFilterChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { v: '', label: '급여 무관' },
    { v: '200', label: '월 200만원~' },
    { v: '250', label: '월 250만원~' },
    { v: '300', label: '월 300만원~' },
    { v: '400', label: '월 400만원~' },
  ];
  const active = options.find((o) => o.v === value) ?? options[0];
  return (
    <details className="relative">
      <summary
        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border cursor-pointer select-none transition-colors list-none ${
          value ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary'
        }`}
      >
        급여: {active.label} ▾
      </summary>
      <div className="absolute left-0 top-full mt-1 z-20 min-w-[160px] border border-gray-200 bg-white shadow-lg">
        {options.map((o) => (
          <button
            key={o.v || 'any'}
            type="button"
            onClick={(e) => { onChange(o.v); (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); }}
            className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${o.v === value ? 'font-bold text-primary' : 'text-gray-700'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </details>
  );
}

function ExperienceFilterChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { v: '', label: '경력 무관' },
    { v: '0', label: '신입 가능' },
    { v: '1', label: '1년 이하' },
    { v: '3', label: '3년 이하' },
    { v: '5', label: '5년 이하' },
  ];
  const active = options.find((o) => o.v === value) ?? options[0];
  return (
    <details className="relative">
      <summary
        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border cursor-pointer select-none transition-colors list-none ${
          value ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary'
        }`}
      >
        경력: {active.label} ▾
      </summary>
      <div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] border border-gray-200 bg-white shadow-lg">
        {options.map((o) => (
          <button
            key={o.v || 'any'}
            type="button"
            onClick={(e) => { onChange(o.v); (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); }}
            className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${o.v === value ? 'font-bold text-primary' : 'text-gray-700'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </details>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="platform-stat-card min-h-[74px]">
      <span className="platform-stat-label">{label}</span>
      <span className="platform-stat-value">{value}</span>
    </div>
  );
}
