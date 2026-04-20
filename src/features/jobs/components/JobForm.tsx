'use client';

import { useState, useRef } from 'react';
import { BUSINESS_TYPES, EMPLOYMENT_TYPES, POSTING_TYPES, REGIONS } from '@/shared/constants';
import { REGION_DETAILS } from '@/shared/constants/regions';
import DatePicker from '@/shared/components/DatePicker';
import { createClient } from '@/lib/supabase/client';
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
  deadline: '',
  image: null,
};

export default function JobForm({ initialData, onSubmit, submitLabel = '등록하기' }: JobFormProps) {
  const [formData, setFormData] = useState<JobFormData>({ ...EMPTY_FORM, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.image ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-images/${initialData.image}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('이미지 크기는 5MB 이하여야 합니다.'); return; }
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.image || null;
    const supabase = createClient();
    const ext = imageFile.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('job-images').upload(path, imageFile, { upsert: true });
    if (uploadError) throw new Error('이미지 업로드에 실패했습니다.');
    return path;
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
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      let imagePath = formData.image;
      if (imageFile) imagePath = await uploadImage();
      else if (!imagePreview) imagePath = null;
      await onSubmit({ ...formData, image: imagePath });
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Posting Type Tabs */}
      <div className="flex border-b border-gray-300">
        {POSTING_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, postingType: type.value }))}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              formData.postingType === type.value
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Title - Big Input */}
      <div className="border-b border-gray-200 pb-4">
        <input
          name="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="제목을 입력해주세요"
          className="naver-title"
          maxLength={100}
        />
      </div>

      {/* Image Upload */}
      {imagePreview ? (
        <div className="relative border border-gray-200">
          <img src={imagePreview} alt="미리보기" className="w-full max-h-[360px] object-contain bg-gray-50" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50">변경</button>
            <button type="button" onClick={handleRemoveImage} className="px-3 py-1.5 bg-white border border-gray-300 text-red-500 text-xs font-medium hover:bg-gray-50">삭제</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border border-dashed border-gray-300 py-10 text-center hover:border-gray-500 transition-colors"
        >
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 18.75h.008v.008H18v-.008zm-3-3h.008v.008H15v-.008z" />
          </svg>
          <p className="text-sm text-gray-500">대표 이미지 추가</p>
          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG 최대 5MB</p>
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

      {/* Description */}
      <div className="border-b border-gray-200 pb-4">
        <textarea
          name="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="업무 내용, 자격 요건 등을 자세히 기재해주세요"
          rows={10}
          className="naver-textarea"
        />
      </div>

      {/* Detail Rows - Naver Style */}
      <div className="naver-form">
        {/* 업종 */}
        <div className="naver-row">
          <div className="naver-label">업종<span className="text-red-500 ml-0.5">*</span></div>
          <div className="naver-content">
            <PillGroup
              options={BUSINESS_TYPES}
              value={formData.businessType}
              onChange={(v) => setFormData(prev => ({ ...prev, businessType: v }))}
            />
          </div>
        </div>

        {/* 고용형태 */}
        <div className="naver-row">
          <div className="naver-label">고용형태<span className="text-red-500 ml-0.5">*</span></div>
          <div className="naver-content">
            <PillGroup
              options={EMPLOYMENT_TYPES}
              value={formData.employmentType}
              onChange={(v) => setFormData(prev => ({ ...prev, employmentType: v }))}
            />
          </div>
        </div>

        {/* 지역 */}
        <div className="naver-row">
          <div className="naver-label">지역<span className="text-red-500 ml-0.5">*</span></div>
          <div className="naver-content">
            <RegionPicker
              value={formData.region}
              onChange={(v) => setFormData(prev => ({ ...prev, region: v }))}
            />
          </div>
        </div>

        {/* 급여 정보 */}
        <div className="naver-row">
          <div className="naver-label">급여 정보</div>
          <div className="naver-content">
            <input
              name="salaryInfo"
              type="text"
              value={formData.salaryInfo}
              onChange={(e) => setFormData(prev => ({ ...prev, salaryInfo: e.target.value }))}
              placeholder="예: 월 300만원 이상, 시급 15,000원, 면접 후 결정"
              className="naver-input"
            />
          </div>
        </div>

        {/* 마감일 */}
        <div className="naver-row">
          <div className="naver-label">마감일</div>
          <div className="naver-content">
            <DatePicker
              value={formData.deadline}
              onChange={(val) => setFormData(prev => ({ ...prev, deadline: val }))}
              placeholder="마감일을 선택하세요"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-2.5 bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '처리 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function PillGroup({ options, value, onChange }: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
          className={`naver-pill ${value === opt.value ? 'naver-pill-active' : 'naver-pill-inactive'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RegionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [browsing, setBrowsing] = useState('');
  const selectedLabel = value ? REGIONS.find(r => r.value === value)?.label : '';
  const details = browsing ? REGION_DETAILS[browsing] : null;

  return (
    <div>
      {selectedLabel && (
        <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-white text-xs font-medium">
          {selectedLabel}
          <button type="button" onClick={() => onChange('')} className="hover:bg-white/20">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <div className="flex gap-0 border border-gray-300">
        <div className={`${details ? 'w-1/3 border-r border-gray-200' : 'w-full'} max-h-[240px] overflow-y-auto`}>
          {REGIONS.map((r) => {
            const hasDetails = !!REGION_DETAILS[r.value];
            const isActive = browsing === r.value || (value === r.value && !browsing);
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  if (hasDetails) setBrowsing(r.value);
                  else { onChange(r.value); setBrowsing(''); }
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                  isActive ? 'bg-primary-50 text-primary font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {r.label}
                {hasDetails && (
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        {details && (
          <div className="w-2/3 max-h-[240px] overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(browsing); setBrowsing(''); }}
              className="w-full text-left px-4 py-2 text-sm font-medium text-primary hover:bg-primary-50 border-b border-gray-100"
            >
              {REGIONS.find(r => r.value === browsing)?.label} 전체
            </button>
            {details.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => { onChange(d.value); setBrowsing(''); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  value === d.value ? 'bg-primary-50 text-primary font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
