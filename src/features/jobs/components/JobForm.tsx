'use client';

import { useState } from 'react';
import { BUSINESS_TYPES, EMPLOYMENT_TYPES, POSTING_TYPES, REGIONS } from '@/shared/constants';
import type { JobFormData } from '../types';

interface JobFormProps {
  initialData?: Partial<JobFormData>;
  onSubmit: (data: JobFormData) => Promise<void>;
  submitLabel?: string;
}

const EMPTY_FORM: JobFormData = {
  postingType: 'hiring',
  title: '',
  description: '',
  businessType: '',
  employmentType: '',
  region: '',
  salaryInfo: '',
  isUrgent: false,
  deadline: '',
};

export default function JobForm({
  initialData,
  onSubmit,
  submitLabel = '등록하기',
}: JobFormProps) {
  const [formData, setFormData] = useState<JobFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const validate = (): string | null => {
    if (!formData.title.trim()) return '제목을 입력해주세요.';
    if (!formData.description.trim()) return '설명을 입력해주세요.';
    if (!formData.businessType) return '업종을 선택해주세요.';
    if (!formData.employmentType) return '고용형태를 선택해주세요.';
    if (!formData.region) return '지역을 선택해주세요.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Posting Type */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          공고 유형 <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3">
          {POSTING_TYPES.map((type) => (
            <label
              key={type.value}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors ${
                formData.postingType === type.value
                  ? 'border-primary bg-primary-50 text-primary'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <input
                type="radio"
                name="postingType"
                value={type.value}
                checked={formData.postingType === type.value}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="font-medium">{type.label}</span>
              <span className="text-xs text-gray-400">
                {type.value === 'hiring' ? '직원 채용' : '협력업체 섭외'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-sm font-medium text-text-primary">
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleChange}
          placeholder="공고 제목을 입력하세요"
          className="input-field w-full"
          maxLength={100}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-medium text-text-primary">
          설명 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="업무 내용, 자격 요건 등을 자세히 기재해주세요"
          rows={8}
          className="input-field w-full resize-y min-h-[160px]"
        />
      </div>

      {/* Select Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Business Type */}
        <div className="space-y-1.5">
          <label htmlFor="businessType" className="block text-sm font-medium text-text-primary">
            업종 <span className="text-red-500">*</span>
          </label>
          <select
            id="businessType"
            name="businessType"
            value={formData.businessType}
            onChange={handleChange}
            className="input-field w-full"
          >
            <option value="">선택해주세요</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Employment Type */}
        <div className="space-y-1.5">
          <label htmlFor="employmentType" className="block text-sm font-medium text-text-primary">
            고용형태 <span className="text-red-500">*</span>
          </label>
          <select
            id="employmentType"
            name="employmentType"
            value={formData.employmentType}
            onChange={handleChange}
            className="input-field w-full"
          >
            <option value="">선택해주세요</option>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Region */}
        <div className="space-y-1.5">
          <label htmlFor="region" className="block text-sm font-medium text-text-primary">
            지역 <span className="text-red-500">*</span>
          </label>
          <select
            id="region"
            name="region"
            value={formData.region}
            onChange={handleChange}
            className="input-field w-full"
          >
            <option value="">선택해주세요</option>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Salary Info */}
      <div className="space-y-1.5">
        <label htmlFor="salaryInfo" className="block text-sm font-medium text-text-primary">
          급여 정보
        </label>
        <input
          id="salaryInfo"
          name="salaryInfo"
          type="text"
          value={formData.salaryInfo}
          onChange={handleChange}
          placeholder="예: 월 300만원 이상, 시급 15,000원"
          className="input-field w-full"
        />
      </div>

      {/* Deadline */}
      <div className="space-y-1.5">
        <label htmlFor="deadline" className="block text-sm font-medium text-text-primary">
          마감일
        </label>
        <input
          id="deadline"
          name="deadline"
          type="date"
          value={formData.deadline}
          onChange={handleChange}
          className="input-field w-full"
        />
      </div>

      {/* Is Urgent */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          name="isUrgent"
          type="checkbox"
          checked={formData.isUrgent}
          onChange={handleChange}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary-300 cursor-pointer"
        />
        <span className="text-sm font-medium text-text-primary">긴급 공고로 등록</span>
        <span className="text-xs text-text-muted">(목록 상단에 노출됩니다)</span>
      </label>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full sm:w-auto px-8 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              처리 중...
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
