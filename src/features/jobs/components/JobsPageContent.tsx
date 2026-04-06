'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Job } from '@/types/database';
import type { JobFilters } from '../types';
import { jobService } from '../services/job-service';
import { BUSINESS_TYPES, EMPLOYMENT_TYPES, REGIONS, ROUTES } from '@/shared/constants';
import { REGION_DETAILS } from '@/shared/constants/regions';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';

const PAGE_SIZE = 20;

interface JobsPageContentProps {
  initialJobs?: Job[];
  initialCount?: number;
}

export default function JobsPageContent({ initialJobs, initialCount }: JobsPageContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRegion, setSelectedRegion] = useState(searchParams.get('region') ?? '');
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>(
    () => {
      const bt = searchParams.get('businessType');
      return bt ? bt.split(',') : [];
    }
  );
  const [selectedEmploymentType, setSelectedEmploymentType] = useState(searchParams.get('employmentType') ?? '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [businessTypeDropdownOpen, setBusinessTypeDropdownOpen] = useState(false);
  const [employmentTypeDropdownOpen, setEmploymentTypeDropdownOpen] = useState(false);
  const [browsingRegion, setBrowsingRegion] = useState(''); // 드롭다운에서 탐색 중인 시/도 (선택 확정 전)
  const [selectedSubRegions, setSelectedSubRegions] = useState<string[]>(
    () => {
      const sub = searchParams.get('subRegion');
      return sub ? sub.split(',') : [];
    }
  );

  const [jobs, setJobs] = useState<Job[]>(initialJobs ?? []);
  const [totalCount, setTotalCount] = useState(initialCount ?? 0);
  const [loading, setLoading] = useState(!initialJobs);

  const currentPage = Number(searchParams.get('page')) || 1;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const postingType = searchParams.get('type') ?? 'hiring';

  const filters: JobFilters = {
    postingType,
    businessType: searchParams.get('businessType') ?? undefined,
    employmentType: searchParams.get('employmentType') ?? undefined,
    region: searchParams.get('region') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  };

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await jobService.getJobs(filters, currentPage, PAGE_SIZE);
      setJobs(result.data);
      setTotalCount(result.count);
    } catch {
      setJobs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setSelectedRegion(searchParams.get('region') ?? '');
    const bt = searchParams.get('businessType');
    setSelectedBusinessTypes(bt ? bt.split(',') : []);
    setSelectedEmploymentType(searchParams.get('employmentType') ?? '');
    setSearch(searchParams.get('search') ?? '');
    const sub = searchParams.get('subRegion');
    setSelectedSubRegions(sub ? sub.split(',') : []);
  }, [searchParams]);


  const handleRegionBrowse = (value: string) => {
    // 시/도 변경 시 세부 지역 초기화
    if (value !== selectedRegion) {
      setSelectedSubRegions([]);
    }
    setSelectedRegion(value);
    updateParams({ region: value, subRegion: '' });
    // 세부 지역이 있으면 세부 패널을 보여줌 (드롭다운 유지)
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
    setSelectedBusinessTypes(prev => {
      const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
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

  // 지역 필터 라벨 생성
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
    selectedBusinessTypes.length > 0 && { key: 'businessType', label: selectedBusinessTypes.map(v => getBusinessTypeLabel(v)).join(', ') },
    selectedEmploymentType && { key: 'employmentType', label: getEmploymentTypeLabel(selectedEmploymentType) },
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
    setSelectedSubRegions([]);
    router.push('/jobs');
  };

  // 드롭다운에서 탐색 중인 지역의 상세 목록
  const browsingRegionDetails = browsingRegion ? REGION_DETAILS[browsingRegion] : null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      {/* Page Title */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {postingType === 'matching' ? '업체 섭외' : '채용'}
        </h1>
        <Link href={ROUTES.JOBS_NEW} className="btn-primary text-sm px-5 py-2.5 rounded-lg">
          공고 등록 →
        </Link>
      </div>

      {/* Top Banner: 추천 업체 + 공고 등록 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { name: '그랜드 웨딩홀', type: '예식장', region: '서울' },
          { name: '로즈드레스', type: '드레스샵', region: '경기' },
          { name: '루미에르 스튜디오', type: '스튜디오', region: '서울' },
        ].map((company) => (
          <div key={company.name} className="bg-white border border-gray-200 rounded-lg px-4 py-3 hover:shadow-sm cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{company.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{company.name}</p>
                <p className="text-xs text-gray-500">{company.type} · {company.region}</p>
              </div>
            </div>
          </div>
        ))}
        <div className="bg-gradient-to-r from-primary to-primary-light rounded-lg px-5 py-3 flex items-center justify-between text-white">
          <div>
            <p className="font-bold text-sm">무료 공고 등록</p>
            <p className="text-xs text-white/80">첫 달 무료!</p>
          </div>
          <Link href={ROUTES.JOBS_NEW} className="bg-white text-primary font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-white/90 transition-colors">
            등록 →
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div>
        {/* Filter Section */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
            {/* Filter Controls Bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
              {/* Region Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    const opening = !regionDropdownOpen;
                    closeAllDropdowns();
                    setRegionDropdownOpen(opening);
                    if (opening) setBrowsingRegion(selectedRegion);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm transition-colors ${
                    regionDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>{selectedRegion
                    ? selectedSubRegions.length > 0
                      ? `지역 · ${getRegionLabel(selectedRegion)}(${selectedSubRegions.length})`
                      : `지역 · ${getRegionLabel(selectedRegion)}`
                    : '지역 선택'}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${regionDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
                  className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm transition-colors ${
                    businessTypeDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                  <span>{selectedBusinessTypes.length > 0 ? `업종 · ${selectedBusinessTypes.length}개` : '업종 선택'}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${businessTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              {/* Employment Type Dropdown - 채용 탭에서만 표시 */}
              {postingType === 'hiring' && (
              <div className="relative">
                <button
                  onClick={() => {
                    const opening = !employmentTypeDropdownOpen;
                    closeAllDropdowns();
                    setEmploymentTypeDropdownOpen(opening);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm transition-colors ${
                    employmentTypeDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  <span>{selectedEmploymentType ? `고용 · ${getEmploymentTypeLabel(selectedEmploymentType)}` : '고용형태'}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${employmentTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
              )}

              {/* Search */}
              <div className="relative flex-1 flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="검색어 입력"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') updateParams({ search }); }}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <button
                  onClick={() => updateParams({ search })}
                  className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors shrink-0"
                >
                  검색
                </button>
              </div>
            </div>

            {/* Region Dropdown Panel */}
            {regionDropdownOpen && (
              <div className="border-b border-gray-200 bg-white">
                <div className="flex">
                  {/* 시/도 목록 */}
                  <div className="w-[200px] border-r border-gray-200 max-h-[360px] overflow-y-auto">
                    <button
                      onClick={() => handleRegionConfirm('')}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                        !browsingRegion ? 'bg-primary/5 text-primary font-semibold' : 'text-gray-700'
                      }`}
                    >
                      전체
                    </button>
                    {REGIONS.map((r) => {
                      const hasDetails = !!REGION_DETAILS[r.value];
                      return (
                        <button
                          key={r.value}
                          onClick={() => hasDetails ? handleRegionBrowse(r.value) : handleRegionConfirm(r.value)}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                            browsingRegion === r.value ? 'bg-primary/5 text-primary font-semibold' : 'text-gray-700'
                          }`}
                        >
                          <span>{r.label}</span>
                          {hasDetails && (
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 시/군/구 상세 */}
                  {browsingRegionDetails && (
                    <div className="flex-1 p-4 max-h-[360px] overflow-y-auto">
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => handleRegionConfirm(browsingRegion)}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          {getRegionLabel(browsingRegion)} 전체 선택
                        </button>
                        <button
                          onClick={() => setRegionDropdownOpen(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          닫기
                        </button>
                      </div>
                      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
                        {browsingRegionDetails.map((detail) => (
                          <label key={detail.value} className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer rounded hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={selectedSubRegions.includes(detail.value)}
                              onChange={() => handleSubRegionToggle(detail.value)}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
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
              <div className="border-b border-gray-200 bg-white px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedBusinessTypes([]); updateParams({ businessType: '' }); }}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
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
                        className={`px-4 py-2 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                          selected
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {selected && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
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

            {/* Employment Type Dropdown Panel - 채용 탭에서만 */}
            {postingType === 'hiring' && employmentTypeDropdownOpen && (
              <div className="border-b border-gray-200 bg-white px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleEmploymentTypeSelect('')}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
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
                      className={`px-4 py-2 rounded-full text-sm transition-colors ${
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

          {/* Active Filters Tags */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {activeFilters.map((f) => (
                <span key={f.key} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/5 text-primary text-sm rounded-full border border-primary/20">
                  {f.label}
                  <button onClick={() => handleRemoveFilter(f.key)} className="ml-0.5 hover:text-primary/70">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <button onClick={handleResetAll} className="text-sm text-gray-400 hover:text-gray-600 ml-1">
                초기화
              </button>
            </div>
          )}

          {/* Results Info */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              선택된 <span className="font-bold text-primary">{totalCount.toLocaleString()}</span>건 검색하기
            </p>
          </div>

          {/* Job List */}
          {loading ? (
            <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
                  <div className="w-10 h-10 bg-gray-100 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-100 rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded" />
                  </div>
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">등록된 채용 공고가 없습니다</h3>
              <p className="text-sm text-gray-500 mb-4">조건에 맞는 채용 공고가 없습니다.</p>
              <Link href={ROUTES.JOBS_NEW} className="btn-primary text-sm px-5 py-2.5 rounded-lg inline-block">
                공고 등록하기
              </Link>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              {jobs.map((job, idx) => (
                <Link
                  key={job.id}
                  href={ROUTES.JOBS_DETAIL(job.id)}
                  className={`flex items-start gap-4 px-5 py-4 hover:bg-blue-50/30 transition-colors group ${
                    idx < jobs.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  {/* Company Logo placeholder */}
                  <div className="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-gray-400">
                      {(job.author?.company_name ?? '업체')[0]}
                    </span>
                  </div>

                  {/* Job Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {job.is_urgent && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded">
                          긴급
                        </span>
                      )}
                      <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
                        {job.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <span className="font-medium text-gray-700">{job.author?.company_name ?? '알 수 없음'}</span>
                      <span className="text-gray-300">|</span>
                      <span>{job.author?.region ? getRegionLabel(job.author.region) : ''}</span>
                      <span className="text-gray-300">|</span>
                      <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                      <span className="text-gray-300">|</span>
                      <span>{getBusinessTypeLabel(job.business_type)}</span>
                    </div>
                    {job.salary_info && (
                      <p className="text-sm text-gray-500 mt-0.5">{job.salary_info}</p>
                    )}
                  </div>

                  {/* Right info */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-gray-400">
                    <time>{formatRelativeTime(job.created_at)}</time>
                    {job.deadline && (
                      <span className="text-primary font-medium">
                        ~{new Date(job.deadline).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="w-8 h-8 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-8 h-8 flex items-center justify-center rounded text-sm ${
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
                className="w-8 h-8 flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
