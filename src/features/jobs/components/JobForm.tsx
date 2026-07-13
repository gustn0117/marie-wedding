'use client';

import { useState, useRef } from 'react';
import { BUSINESS_TYPES, EMPLOYMENT_TYPES, REGIONS } from '@/shared/constants';
import { REGION_DETAILS } from '@/shared/constants/regions';
import DatePicker from '@/shared/components/DatePicker';
import ImageUploadHint from '@/shared/components/ImageUploadHint';
import { compressImage } from '@/shared/utils/image';
import { withTimeout } from '@/shared/utils/withTimeout';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/shared/components/Toast';
import type { JobFormData } from '../types';

interface JobFormProps {
  initialData?: Partial<JobFormData>;
  onSubmit: (data: JobFormData) => Promise<void>;
  submitLabel?: string;
}

import {
  JOB_SECTIONS,
  EMPTY_JOB_SECTIONS,
  serializeSections,
  parseSections,
  type JobSectionKey,
  type JobSectionMap,
} from '@/features/jobs/lib/parse-job-description';

// JobForm용 UI 메타 (placeholder · 필수 여부)
const FORM_SECTION_META: Record<JobSectionKey, { placeholder: string; required: boolean }> = {
  duty: {
    placeholder: '예) 예식 당일 진행, 상담·예약, 고객 응대\n팀 구성과 현장 분위기도 함께 적어주세요.',
    required: true,
  },
  requirements: {
    placeholder: '예) 경력 1년 이상, 주말 가능, 메이크업 자격증\n신입 가능 여부, 교육 제공 여부를 알려주세요.',
    required: true,
  },
  conditions: {
    placeholder: '예) 강남, 월~금 10–18시, 월 320만원\n채용 인원, 시작 가능일, 고용 형태(정규/계약/단기 등)를 적어주세요.',
    required: true,
  },
  apply: {
    placeholder: '예) 이름·연락처·경력 요약·가능 일정·포트폴리오 링크',
    required: false,
  },
  extra: {
    placeholder: '복지·휴가·차량 지원·식대·우대 사항 등 자유롭게 작성해 주세요. (선택)',
    required: false,
  },
};

const EMPTY_FORM: JobFormData = {
  postingType: 'hiring',
  title: '',
  description: '', // 가이드는 상단 박스에만, 본문은 비워서 시작
  businessType: '',
  employmentType: '',
  region: '',
  salaryInfo: '',
  salaryMin: null,
  salaryMax: null,
  salaryUnit: 'monthly',
  experienceMin: null,
  deadline: '',
  image: null,
};

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function JobForm({ initialData, onSubmit, submitLabel = '공고 등록하기' }: JobFormProps) {
  const [formData, setFormData] = useState<JobFormData>({ ...EMPTY_FORM, ...initialData, postingType: 'hiring' });
  const [sections, setSections] = useState<JobSectionMap>(() =>
    initialData?.description ? parseSections(initialData.description).sections : { ...EMPTY_JOB_SECTIONS }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.image ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-images/${initialData.image}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 합쳐진 description (검증·미리보기·submit용)
  const composedDescription = serializeSections(sections);
  const plainComposed = stripHtml(composedDescription);

  const setSection = (key: JobSectionKey, value: string) => {
    setSections((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 크기 제한 없음 — 저장 시 자동 압축.
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
    const compressed = await compressImage(imageFile, { maxDimension: 1280, quality: 0.8 });
    const ext = compressed.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}.${ext}`;
    const { error: uploadError } = await withTimeout(supabase.storage.from('job-images').upload(path, compressed, { upsert: true }), 20000, '이미지 업로드가 너무 오래 걸려요.');
    if (uploadError) throw new Error('이미지 업로드에 실패했습니다.');
    return path;
  };

  const validate = (): string | null => {
    if (!formData.title.trim()) return '제목을 입력해주세요.';
    for (const sec of JOB_SECTIONS) {
      if (FORM_SECTION_META[sec.key].required && !sections[sec.key].trim()) {
        return `${sec.title}를 입력해주세요.`;
      }
    }
    if (!formData.businessType) return '업종을 선택해주세요.';
    if (!formData.employmentType) return '고용형태를 선택해주세요.';
    if (!formData.region) return '지역을 선택해주세요.';

    // 급여 범위 검증 — INTEGER 컬럼 초과·역전 방지 (null = 미기재 허용)
    const MAX_SALARY = 100_000_000;
    for (const [label, v] of [['최소', formData.salaryMin], ['최대', formData.salaryMax]] as const) {
      if (v != null && (!Number.isInteger(v) || v < 0 || v > MAX_SALARY)) {
        return `급여 ${label}값은 0 이상 ${MAX_SALARY.toLocaleString()} 이하의 정수여야 합니다.`;
      }
    }
    if (formData.salaryMin != null && formData.salaryMax != null && formData.salaryMin > formData.salaryMax) {
      return '급여 최소값이 최대값보다 클 수 없습니다.';
    }
    // 최소 경력 검증 — INTEGER 컬럼 초과·음수 방지
    if (
      formData.experienceMin != null &&
      (!Number.isInteger(formData.experienceMin) || formData.experienceMin < 0 || formData.experienceMin > 50)
    ) {
      return '최소 경력은 0 이상 50 이하의 정수여야 합니다.';
    }

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
      let imageFailed = false;
      if (imageFile) {
        // 이미지 업로드는 비치명적 — 실패해도 공고는 등록한다(기존 이미지 유지).
        try {
          imagePath = await uploadImage();
        } catch (e) {
          console.warn('[JobForm] 이미지 업로드 실패, 공고는 계속 등록:', e);
          imageFailed = true;
          imagePath = formData.image ?? null;
        }
      } else if (!imagePreview) {
        imagePath = null;
      }
      await onSubmit({
        ...formData,
        postingType: 'hiring',
        image: imagePath,
        description: composedDescription, // 5개 섹션을 합친 HTML
      });
      if (imageFailed) {
        toast('공고는 등록됐지만 이미지 업로드에 실패했어요. 수정에서 다시 시도해주세요.', 'error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필수 항목 완성도
  const requiredFilled = [
    formData.title.trim(),
    plainComposed.trim(),
    formData.businessType,
    formData.employmentType,
    formData.region,
  ].filter(Boolean).length;
  const totalRequired = 5;
  const progress = Math.round((requiredFilled / totalRequired) * 100);
  const qualityItems = [
    {
      key: 'description',
      label: '업무/자격/근무조건을 충분히 작성',
      done: plainComposed.length >= 120,
    },
    {
      key: 'salary',
      label: '급여 또는 협의 기준 공개',
      done: !!(formData.salaryInfo ?? '').trim() || formData.salaryMin != null || formData.salaryMax != null,
    },
    {
      key: 'deadline',
      label: '지원 마감일 설정',
      done: !!formData.deadline,
    },
    {
      key: 'image',
      label: '근무지/브랜드 이미지 추가',
      done: !!imagePreview || !!formData.image,
    },
  ];
  const qualityCount = qualityItems.filter((item) => item.done).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Progress Bar */}
      <div className="sticky top-[138px] z-10 rounded border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">필수 항목 입력 <span className="font-semibold text-primary">{requiredFilled}/{totalRequired}</span></span>
          <span className="text-xs font-semibold text-primary">{progress}%</span>
        </div>
        <div className="h-1 bg-gray-100 overflow-hidden rounded-full">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <section className="rounded border border-primary/20 bg-primary-50 p-4">
        <div>
          <p className="text-sm font-bold text-gray-900">공고 품질 체크 {qualityCount}/{qualityItems.length}</p>
          <p className="mt-1 text-xs text-gray-600">좋은 공고일수록 검색, 추천, 광고 노출에서 클릭과 지원 전환이 좋아집니다.</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {qualityItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-xs">
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${item.done ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-300'}`}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
              <span className={item.done ? 'font-semibold text-primary' : 'text-gray-600'}>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="p-4 bg-state-urgent-bg border-l-4 border-state-urgent flex items-start gap-3">
          <svg className="w-5 h-5 text-state-urgent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-state-urgent">{error}</p>
        </div>
      )}

      {/* STEP 1: 기본 정보 */}
      <Section step={1} title="채용 공고로 등록됩니다" description="마리에는 웨딩업계 구인구직 중심으로 운영됩니다.">
        <div className="rounded border-2 border-primary bg-primary-50 p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-bold text-primary">채용 공고</span>
            <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            직원, 프리랜서, 단기 스태프 등 웨딩 현장 인력을 찾는 공고만 등록할 수 있습니다.
          </p>
        </div>
      </Section>

      {/* STEP 2: 제목 & 이미지 */}
      <Section step={2} title="제목과 대표 이미지를 입력하세요" description="직무, 지역, 고용형태가 한눈에 보이면 검색과 클릭 전환이 좋아집니다.">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-800">제목 <span className="text-state-urgent">*</span></label>
              <span className="text-xs text-gray-400">{formData.title.length}/100</span>
            </div>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="예) 강남 예식장 예약 매니저 정규직 채용"
              className="w-full rounded border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
              maxLength={100}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['서울 웨딩플래너 신입/경력 채용', '주말 예식 진행 스태프 단기알바', '부산 스튜디오 상담 매니저 모집'].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, title: example }))}
                  className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-500 hover:border-primary hover:text-primary"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">대표 이미지 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
            <ImageUploadHint ratio="16:9 (가로형)" recommendedSize="1200 × 675px" maxSize="5MB" note="목록에서 잘 보이도록 가로가 넓은 이미지 권장" />
            <div className="mt-2">
            {imagePreview ? (
              <div className="relative overflow-hidden rounded border border-gray-300">
                <img src={imagePreview} alt="" className="w-full max-h-[320px] object-contain bg-gray-50" />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded bg-white/95 border border-gray-200 px-3 py-1.5 text-gray-700 text-xs font-bold hover:bg-white">변경</button>
                  <button type="button" onClick={handleRemoveImage} className="rounded bg-white/95 border border-gray-200 px-3 py-1.5 text-state-urgent text-xs font-bold hover:bg-white">삭제</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded border-2 border-dashed border-gray-300 py-10 text-center hover:border-primary hover:bg-primary-50/30 transition-colors"
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

      {/* STEP 3: 상세 내용 — 5개 섹션별 입력 */}
      <Section step={3} title="상세 내용을 작성하세요" description="항목별로 나눠 적으면 지원자가 한눈에 파악할 수 있어요. 빈 항목은 등록 후에도 보이지 않습니다.">
        <div className="space-y-5">
          {JOB_SECTIONS.map((sec) => {
            const meta = FORM_SECTION_META[sec.key];
            return (
            <div key={sec.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={`section-${sec.key}`} className="text-sm font-semibold text-gray-800">
                  {sec.title}
                  {meta.required && <span className="text-state-urgent ml-1">*</span>}
                  {!meta.required && <span className="ml-2 text-[11px] font-normal text-gray-400">선택</span>}
                </label>
                <span className="text-[11px] text-gray-400 tabular-nums">{sections[sec.key].length}자</span>
              </div>
              <textarea
                id={`section-${sec.key}`}
                value={sections[sec.key]}
                onChange={(e) => setSection(sec.key, e.target.value)}
                placeholder={meta.placeholder}
                rows={sec.key === 'extra' ? 3 : 4}
                className="w-full rounded border border-gray-300 px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 placeholder:whitespace-pre-line focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100 resize-y"
                required={meta.required}
              />
            </div>
            );
          })}

          <p className="text-[11px] text-gray-400 text-right">
            총 {plainComposed.length}자 — 충분히 작성할수록 지원자 클릭률이 올라가요
          </p>
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
              className="w-full rounded border border-gray-300 px-4 py-2.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
            />
          </FieldRow>

          <FieldRow label="급여 범위" hint="검색 필터에 사용됩니다. 월급/연봉은 만원 단위, 일급/시급은 원 단위로 입력하세요.">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px] gap-2">
              <input
                type="number"
                value={formData.salaryMin ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, salaryMin: e.target.value ? Number(e.target.value) : null }))}
                placeholder="최소 (만원)"
                min={0}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <input
                type="number"
                value={formData.salaryMax ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, salaryMax: e.target.value ? Number(e.target.value) : null }))}
                placeholder="최대 (만원)"
                min={0}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <select
                value={formData.salaryUnit ?? 'monthly'}
                onChange={(e) => setFormData(prev => ({ ...prev, salaryUnit: e.target.value as 'monthly' | 'yearly' | 'daily' | 'hourly' }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
              >
                <option value="monthly">월급</option>
                <option value="yearly">연봉</option>
                <option value="daily">일급</option>
                <option value="hourly">시급</option>
              </select>
            </div>
          </FieldRow>

          <FieldRow label="최소 경력" hint="신입 가능이면 0을 입력하세요. 미입력 시 무관.">
            <div className="flex items-center gap-2 max-w-[200px]">
              <input
                type="number"
                value={formData.experienceMin ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, experienceMin: e.target.value !== '' ? Number(e.target.value) : null }))}
                placeholder="예) 2"
                min={0}
                max={30}
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <span className="text-sm text-gray-500">년 이상</span>
            </div>
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
      <div
        className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <p className="text-xs text-gray-500">
          필수 항목 {requiredFilled}/{totalRequired}개 입력 완료
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded border border-gray-300 px-6 py-3 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-primary px-10 py-3 text-sm font-bold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    <section className="rounded border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 bg-primary text-white text-xs font-bold flex items-center justify-center rounded shrink-0">{step}</span>
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
          {required && <span className="text-state-urgent ml-0.5">*</span>}
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
            className={`rounded px-4 py-2 text-sm font-bold border transition-all ${
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
          <span className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-sm font-bold text-white">
            {selectedLabel}
            <button type="button" onClick={() => onChange('')} className="hover:opacity-70">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      )}
      <div className="overflow-hidden rounded border border-gray-300 bg-white">
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
