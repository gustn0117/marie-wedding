'use client';

import { useState, useRef } from 'react';
import { BUSINESS_TYPES, EMPLOYMENT_TYPES, POSTING_TYPES, REGIONS } from '@/shared/constants';
import { REGION_DETAILS } from '@/shared/constants/regions';
import DatePicker from '@/shared/components/DatePicker';
import RichTextEditor from '@/shared/components/RichTextEditor';
import ImageUploadHint from '@/shared/components/ImageUploadHint';
import { compressImage } from '@/shared/utils/image';
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

export default function JobForm({ initialData, onSubmit, submitLabel = '공고 등록하기' }: JobFormProps) {
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
    const compressed = await compressImage(imageFile, { maxDimension: 1600, quality: 0.85 });
    const ext = compressed.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('job-images').upload(path, compressed, { upsert: true });
    if (uploadError) throw new Error('이미지 업로드에 실패했습니다.');
    return path;
  };

  const validate = (): string | null => {
    if (!formData.title.trim()) return '제목을 입력해주세요.';
    if (!formData.description.trim()) return '상세 설명을 입력해주세요.';
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

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

  // 필수 항목 완성도
  const requiredFilled = [
    formData.postingType,
    formData.title.trim(),
    formData.description.trim(),
    formData.businessType,
    formData.employmentType,
    formData.region,
  ].filter(Boolean).length;
  const totalRequired = 6;
  const progress = Math.round((requiredFilled / totalRequired) * 100);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Progress Bar */}
      <div className="sticky top-[110px] z-10 bg-white pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">필수 항목 입력 <span className="font-semibold text-primary">{requiredFilled}/{totalRequired}</span></span>
          <span className="text-xs font-semibold text-primary">{progress}%</span>
        </div>
        <div className="h-1 bg-gray-100 overflow-hidden rounded-full">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* STEP 1: 기본 정보 */}
      <Section step={1} title="공고 유형을 선택하세요" description="채용 공고인지, 업체를 찾는 섭외 공고인지 선택해주세요.">
        <div className="grid grid-cols-2 gap-3">
          {POSTING_TYPES.map((type) => {
            const isActive = formData.postingType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, postingType: type.value }))}
                className={`p-5 border-2 text-left transition-all ${
                  isActive ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-base font-bold ${isActive ? 'text-primary' : 'text-gray-800'}`}>{type.label}</span>
                  {isActive && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {type.value === 'hiring' ? '직원을 채용하고 싶어요' : '협력 업체를 찾고 있어요'}
                </p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* STEP 2: 제목 & 이미지 */}
      <Section step={2} title="제목과 대표 이미지를 입력하세요" description="구직자/업체의 관심을 끌 수 있도록 간결하고 명확하게 작성해주세요.">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-800">제목 <span className="text-red-500">*</span></label>
              <span className="text-xs text-gray-400">{formData.title.length}/100</span>
            </div>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="예) 강남 예식장 예약 매니저 정규직 채용"
              className="w-full px-4 py-3 border border-gray-300 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">대표 이미지 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
            <ImageUploadHint ratio="16:9 (가로형)" recommendedSize="1200 × 675px" maxSize="5MB" note="목록에서 잘 보이도록 가로가 넓은 이미지 권장" />
            <div className="mt-2">
            {imagePreview ? (
              <div className="relative border border-gray-300 overflow-hidden">
                <img src={imagePreview} alt="" className="w-full max-h-[320px] object-contain bg-gray-50" />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white/95 border border-gray-200 text-gray-700 text-xs font-medium hover:bg-white">변경</button>
                  <button type="button" onClick={handleRemoveImage} className="px-3 py-1.5 bg-white/95 border border-gray-200 text-red-500 text-xs font-medium hover:bg-white">삭제</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 py-10 text-center hover:border-primary hover:bg-primary-50/30 transition-colors"
              >
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <p className="text-sm font-medium text-gray-700">클릭하여 이미지 추가</p>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </div>
          </div>
        </div>
      </Section>

      {/* STEP 3: 상세 내용 */}
      <Section step={3} title="상세 내용을 작성하세요" description="글자 굵기, 크기, 목록 등 서식을 사용할 수 있어요.">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-800">상세 설명 <span className="text-red-500">*</span></label>
          </div>
          <RichTextEditor
            value={formData.description}
            onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
            placeholder="- 담당 업무&#10;- 자격 요건&#10;- 우대 사항&#10;- 근무 조건 등을 자세히 작성해주세요."
            minHeight={240}
          />
        </div>
      </Section>

      {/* STEP 4: 세부 조건 */}
      <Section step={4} title="세부 조건을 선택하세요" description="정확한 조건을 선택하면 적합한 지원자를 찾을 수 있어요.">
        <div className="space-y-5">
          <FieldRow label="업종" required hint="업체가 속한 분야를 선택해주세요">
            <PillGroup
              options={BUSINESS_TYPES}
              value={formData.businessType}
              onChange={(v) => setFormData(prev => ({ ...prev, businessType: v }))}
            />
          </FieldRow>

          <FieldRow label="고용형태" required hint="정규직, 계약직, 단기알바 중 선택">
            <PillGroup
              options={EMPLOYMENT_TYPES}
              value={formData.employmentType}
              onChange={(v) => setFormData(prev => ({ ...prev, employmentType: v }))}
            />
          </FieldRow>

          <FieldRow label="지역" required hint="근무 지역을 선택해주세요. 세부 지역(구/군)까지 선택 가능">
            <RegionPicker
              value={formData.region}
              onChange={(v) => setFormData(prev => ({ ...prev, region: v }))}
            />
          </FieldRow>
        </div>
      </Section>

      {/* STEP 5: 추가 정보 */}
      <Section step={5} title="추가 정보 (선택)" description="선택 입력이지만, 기재하면 더 많은 관심을 받을 수 있어요.">
        <div className="space-y-5">
          <FieldRow label="급여 정보" hint="연봉/월급/시급을 구체적으로 기재하면 좋아요">
            <input
              type="text"
              value={formData.salaryInfo}
              onChange={(e) => setFormData(prev => ({ ...prev, salaryInfo: e.target.value }))}
              placeholder="예) 월 300만원 이상 · 시급 15,000원 · 면접 후 결정"
              className="w-full px-4 py-2.5 border border-gray-300 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </FieldRow>

          <FieldRow label="마감일" hint="지원 마감일을 설정하면 구직자가 더 빠르게 지원해요">
            <DatePicker
              value={formData.deadline}
              onChange={(val) => setFormData(prev => ({ ...prev, deadline: val }))}
              placeholder="마감일을 선택하세요"
            />
          </FieldRow>
        </div>
      </Section>

      {/* Submit */}
      <div className="flex items-center justify-between gap-3 pt-6 border-t border-gray-300 sticky bottom-0 bg-white -mx-4 px-4 py-4">
        <p className="text-xs text-gray-500">
          필수 항목 {requiredFilled}/{totalRequired}개 입력 완료
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-10 py-3 bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ step, title, description, children }: { step: number; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border-l-4 border-primary pl-3 sm:pl-5 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 bg-primary text-white text-xs font-bold flex items-center justify-center rounded-full shrink-0">{step}</span>
        <h2 className="text-base sm:text-lg font-bold text-gray-900">{title}</h2>
      </div>
      <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:ml-8">{description}</p>
      <div className="sm:ml-8">{children}</div>
    </section>
  );
}

function FieldRow({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5">
        <label className="text-sm font-semibold text-gray-800">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function PillGroup({ options, value, onChange }: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? '' : opt.value)}
            className={`px-4 py-2 text-sm font-medium border transition-all ${
              active
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
            }`}
          >
            {active && (
              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function RegionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [browsing, setBrowsing] = useState('');
  // 시/도 또는 구/군에서 label 찾기
  const findLabel = (val: string): string => {
    const region = REGIONS.find(r => r.value === val);
    if (region) return region.label;
    for (const details of Object.values(REGION_DETAILS)) {
      const detail = details.find(d => d.value === val);
      if (detail) {
        const parentKey = Object.keys(REGION_DETAILS).find(k => REGION_DETAILS[k].some(d => d.value === val));
        const parentLabel = parentKey ? REGIONS.find(r => r.value === parentKey)?.label : '';
        return parentLabel ? `${parentLabel} ${detail.label}` : detail.label;
      }
    }
    return val;
  };
  const selectedLabel = value ? findLabel(value) : '';
  const details = browsing ? REGION_DETAILS[browsing] : null;

  return (
    <div>
      {selectedLabel && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">선택됨:</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-sm font-medium">
            {selectedLabel}
            <button type="button" onClick={() => onChange('')} className="hover:opacity-70">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      )}
      <div className="border border-gray-300 overflow-hidden">
        {/* 모바일: 뷰 전환 / 데스크톱: 2단 */}
        <div className="flex sm:flex-row">
          {/* 시/도 목록 - 모바일에선 details 있으면 숨김 */}
          <div className={`${details ? 'hidden sm:block sm:w-1/3 sm:border-r sm:border-gray-200' : 'w-full'} max-h-[280px] overflow-y-auto`}>
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
                  className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                    isActive ? 'bg-primary-50 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{r.label}</span>
                  {hasDetails && (
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* 구/군 상세 */}
          {details && (
            <div className="w-full sm:w-2/3 max-h-[280px] overflow-y-auto">
              {/* 모바일 전용 뒤로가기 */}
              <button
                type="button"
                onClick={() => setBrowsing('')}
                className="sm:hidden w-full text-left px-4 py-2.5 text-xs text-gray-500 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                시/도 목록으로
              </button>
              <button
                type="button"
                onClick={() => { onChange(browsing); setBrowsing(''); }}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-primary hover:bg-primary-50 border-b border-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {REGIONS.find(r => r.value === browsing)?.label} 전체 선택
              </button>
              {details.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => { onChange(d.value); setBrowsing(''); }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    value === d.value ? 'bg-primary-50 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {!selectedLabel && <p className="text-xs text-gray-400 mt-1.5">시/도 선택 후 구/군까지 선택할 수 있습니다.</p>}
    </div>
  );
}
