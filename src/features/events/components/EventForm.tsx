'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import RichTextEditor from '@/shared/components/RichTextEditor';
import DatePicker from '@/shared/components/DatePicker';
import ImageUploadHint from '@/shared/components/ImageUploadHint';
import { withTimeout } from '@/shared/utils/withTimeout';
import { createClient } from '@/lib/supabase/client';
import { useImageUpload } from '@/shared/hooks/useImageUpload';
import { usePendingUploads } from '@/shared/hooks/usePendingUploads';
import { useUnsavedChangesWarning } from '@/shared/hooks/useUnsavedChangesWarning';
import { adminService } from '@/features/admin/services/admin-service';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { FieldWarning, fieldWrapClass } from '@/shared/components/FieldWarning';
import { EVENT_TYPES, EVENT_TYPE_DESCRIPTIONS } from '../types';
import type { EventFormData } from '../types';

interface EventFormProps {
  initialData?: Partial<EventFormData>;
  eventId?: string;
}

const EMPTY: EventFormData = {
  title: '',
  content: '',
  type: 'event',
  image: null,
  start_date: '',
  end_date: '',
  location: '',
  link_url: '',
  is_pinned: false,
};

export default function EventForm({ initialData, eventId }: EventFormProps) {
  const router = useRouter();
  const isEdit = !!eventId;

  const [formData, setFormDataRaw] = useState<EventFormData>({ ...EMPTY, ...initialData });
  const [dirty, setDirty] = useState(false);
  const { fieldError, setFieldError, showFieldIssue } = useFieldError('eventfield');
  const setFormData = (v: Parameters<typeof setFormDataRaw>[0]) => { setDirty(true); setFieldError(null); setFormDataRaw(v); };
  useUnsavedChangesWarning(dirty);
  const contentRef = useRef(formData.content);
  // 응답만 유실된 생성 요청을 동일 PK로 안전하게 재시도한다.
  const createIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const imageUpload = useImageUpload({
    initialPath: initialData?.image ?? null,
    initialUrl: initialData?.image
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-images/${initialData.image}`
      : null,
    bucket: 'event-images',
    uploadEndpoint: '/api/admin/upload-image?target=event-cover',
    maxDimension: 1600,
    maxSizeMB: 0.9,
    quality: 0.84,
    buildPath: (compressed) => `covers/${Date.now()}_${crypto.randomUUID()}.${compressed.name.split('.').pop() || 'webp'}`,
  });
  const { trackUpload, waitForUploads, hasPendingUploads, pendingCount } = usePendingUploads();

  const handleContentChange = (html: string) => {
    contentRef.current = html;
    setFormData((prev) => ({ ...prev, content: html }));
  };

  // 파일 고르는 즉시 백그라운드 업로드 → 저장은 텍스트만.
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submittingRef.current) {
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 가능합니다.'); return; }
    setError(null);
    imageUpload.selectFile(file);
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    if (submittingRef.current) return;
    imageUpload.remove();
    setFormData(prev => ({ ...prev, image: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!formData.title.trim()) { showFieldIssue({ field: 'title', message: '제목을 입력해주세요.' }); return; }
    if (!contentRef.current.trim() && !hasPendingUploads()) {
      showFieldIssue({ field: 'content', message: '내용을 입력해주세요.' });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      // 신규 등록 시 동일 제목 행사가 이미 존재하면 사용자 확인 (hang 방지 타임아웃)
      if (!isEdit) {
        try {
          const sb = createClient();
          const { data: dup } = await withTimeout(
            sb.from('events').select('id').eq('title', formData.title.trim()).is('deleted_at', null).limit(1).maybeSingle(),
            8000, '중복 확인 지연',
          );
          if (dup && !confirm(`동일한 제목의 행사가 이미 등록되어 있어요. 계속 등록하시겠어요?`)) {
            setSubmitting(false);
            return;
          }
        } catch { /* 중복확인 실패해도 등록은 진행 */ }
      }

      const [imagePath] = await Promise.all([
        imageUpload.waitForUpload(),
        waitForUploads(),
      ]);
      const latestContent = contentRef.current;
      if (!latestContent.trim()) {
        showFieldIssue({ field: 'content', message: '내용을 입력해주세요.' });
        return;
      }
      const payload = {
        ...formData,
        content: latestContent,
        image: imageUpload.preview ? imagePath : null,
      };

      if (isEdit && eventId) {
        await adminService.updateEvent(eventId, payload);
        router.push(`/admin/events`);
        router.refresh();
      } else {
        const createId = createIdRef.current ?? crypto.randomUUID();
        createIdRef.current = createId;
        await adminService.createEvent(payload, createId);
        router.push(`/admin/events`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={submitting} className="contents">
      {error && (
        <div className="p-3 bg-state-urgent-bg border-l-4 border-state-urgent text-sm text-state-urgent">{error}</div>
      )}

      {/* Type */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800">행사 유형 <span className="text-state-urgent">*</span></label>
        <div className="grid gap-2 sm:grid-cols-3">
          {EVENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, type: t.value }))}
              className={`rounded border px-4 py-3 text-left text-sm transition-colors ${
                formData.type === t.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
              }`}
            >
              <span className="block font-bold">{t.label}</span>
              <span className={`mt-1 block text-[11px] leading-snug ${formData.type === t.value ? 'text-white/75' : 'text-gray-400'}`}>
                {EVENT_TYPE_DESCRIPTIONS[t.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div id="eventfield-title" className={`space-y-2 ${fieldWrapClass(fieldError?.field === 'title')}`}>
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-800">제목 <span className="text-state-urgent">*</span></label>
          <span className="text-xs text-gray-400">{formData.title.length}/200</span>
        </div>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="예) 코엑스 웨딩박람회 부스 스태프 모집 연계"
          className="w-full px-4 py-3 border border-gray-300 text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          maxLength={200}
        />
        {fieldError?.field === 'title' && <FieldWarning message={fieldError.message} />}
        <div className="flex flex-wrap gap-1.5">
          {['코엑스 웨딩박람회 일정', 'SETEC 웨딩페어 채용행사', '드레스 브랜드 쇼케이스'].map((example) => (
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

      {/* Image */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800">대표 이미지 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
        <ImageUploadHint ratio="16:9 (가로형)" recommendedSize="1200 × 675px" maxSize="자동 압축" note="목록 카드에 크게 노출됩니다" />
        {imageUpload.preview ? (
          <div className="relative border border-gray-200">
            <img src={imageUpload.preview} alt="" className="w-full max-h-[320px] object-contain bg-gray-50" />
            <div className="absolute top-2 right-2 flex gap-1.5">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white/95 border border-gray-200 text-xs font-medium">변경</button>
              <button type="button" onClick={handleRemoveImage} className="px-3 py-1.5 bg-white/95 border border-gray-200 text-state-urgent text-xs font-medium">삭제</button>
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
            <p className="text-sm text-gray-500">이미지 추가</p>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        {imageUpload.uploading && (
          <div aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${imageUpload.progress?.percent ?? 1}%` }} />
            </div>
            <p className="mt-1 text-xs font-medium text-primary">{imageUpload.statusText}</p>
          </div>
        )}
        {imageUpload.error && <p className="text-xs text-state-urgent">{imageUpload.error}</p>}
      </div>

      {/* Content */}
      <div id="eventfield-content" className={`space-y-2 ${fieldWrapClass(fieldError?.field === 'content')}`}>
        <label className="block text-sm font-semibold text-gray-800">상세 내용 <span className="text-state-urgent">*</span></label>
        <RichTextEditor
          value={formData.content}
          onChange={handleContentChange}
          placeholder="- 행사 개요&#10;- 참가 업체/분야&#10;- 필요한 인력 또는 연결될 채용 수요&#10;- 신청 방법과 유의사항"
          minHeight={300}
          imageBucket="event-images"
          imageUploadEndpoint="/api/admin/upload-image?target=event-content"
          onUploadPromise={trackUpload}
          disabled={submitting}
        />
        {fieldError?.field === 'content' && <FieldWarning message={fieldError.message} />}
      </div>

      {/* Event details */}
      <div className="bg-gray-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">행사 일정 정보</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">시작일</label>
            <DatePicker
              value={formData.start_date}
              onChange={(v) => setFormData(prev => ({ ...prev, start_date: v }))}
              placeholder="시작일 선택"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">종료일</label>
            <DatePicker
              value={formData.end_date}
              onChange={(v) => setFormData(prev => ({ ...prev, end_date: v }))}
              placeholder="종료일 선택"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">장소</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
            placeholder="예: 서울 코엑스 3층 컨퍼런스룸, SETEC 2전시장"
            className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">외부 신청/상세 링크</label>
          <input
            type="url"
            value={formData.link_url}
            onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
            placeholder="https:// 행사 상세 또는 사전 신청 링크"
            className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Pinned */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.is_pinned}
          onChange={(e) => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
          className="w-4 h-4 accent-primary"
        />
        <span className="text-sm font-medium text-gray-800">상단 고정</span>
        <span className="text-xs text-gray-400">(행사·박람회 목록 최상단에 노출됩니다)</span>
      </label>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => { if (!dirty || confirm('작성 중인 내용이 저장되지 않습니다. 나가시겠어요?')) router.push('/admin/events'); }}
          className="px-5 py-2.5 border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >취소</button>
        <button
          type="submit"
          disabled={submitting}
          className="px-8 py-2.5 bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {submitting
            ? (imageUpload.uploading
              ? imageUpload.statusText
              : pendingCount > 0
                ? `본문 사진 ${pendingCount}건 마무리 중...`
                : '저장 중...')
            : isEdit ? '수정하기' : '등록하기'}
        </button>
      </div>
      </fieldset>
    </form>
  );
}
