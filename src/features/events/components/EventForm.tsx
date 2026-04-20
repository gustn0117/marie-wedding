'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RichTextEditor from '@/shared/components/RichTextEditor';
import DatePicker from '@/shared/components/DatePicker';
import { createClient } from '@/lib/supabase/client';
import { eventService } from '../services/event-service';
import { EVENT_TYPES } from '../types';
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

  const [formData, setFormData] = useState<EventFormData>({ ...EMPTY, ...initialData });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.image ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-images/${initialData.image}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('이미지는 5MB 이하여야 합니다.'); return; }
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 가능합니다.'); return; }
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
    const ext = imageFile.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('event-images').upload(path, imageFile, { upsert: true });
    if (uploadError) throw new Error('이미지 업로드 실패');
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!formData.content.trim()) { setError('내용을 입력해주세요.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      let imagePath = formData.image;
      if (imageFile) imagePath = await uploadImage();
      else if (!imagePreview) imagePath = null;

      const payload = { ...formData, image: imagePath };

      if (isEdit && eventId) {
        await eventService.updateEvent(eventId, payload);
        router.push(`/admin/events`);
      } else {
        await eventService.createEvent(payload);
        router.push(`/admin/events`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-sm text-red-700">{error}</div>
      )}

      {/* Type */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800">구분 <span className="text-red-500">*</span></label>
        <div className="flex gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, type: t.value }))}
              className={`px-4 py-2 text-sm font-medium border transition-colors ${
                formData.type === t.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-800">제목 <span className="text-red-500">*</span></label>
          <span className="text-xs text-gray-400">{formData.title.length}/200</span>
        </div>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="제목을 입력하세요"
          className="w-full px-4 py-3 border border-gray-300 text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          maxLength={200}
        />
      </div>

      {/* Image */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800">대표 이미지 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
        {imagePreview ? (
          <div className="relative border border-gray-200">
            <img src={imagePreview} alt="" className="w-full max-h-[320px] object-contain bg-gray-50" />
            <div className="absolute top-2 right-2 flex gap-1.5">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white/95 border border-gray-200 text-xs font-medium">변경</button>
              <button type="button" onClick={handleRemoveImage} className="px-3 py-1.5 bg-white/95 border border-gray-200 text-red-500 text-xs font-medium">삭제</button>
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
      </div>

      {/* Content */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800">상세 내용 <span className="text-red-500">*</span></label>
        <RichTextEditor
          value={formData.content}
          onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
          placeholder="이벤트/소식 내용을 입력하세요."
          minHeight={300}
          imageBucket="event-images"
        />
      </div>

      {/* Event details */}
      <div className="bg-gray-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">이벤트 정보 (선택)</h3>
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
            placeholder="예: 서울 코엑스 A홀"
            className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">외부 링크</label>
          <input
            type="url"
            value={formData.link_url}
            onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
            placeholder="https://"
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
        <span className="text-xs text-gray-400">(목록 최상단에 노출됩니다)</span>
      </label>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
        <Link href="/admin/events" className="px-5 py-2.5 border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</Link>
        <button
          type="submit"
          disabled={submitting}
          className="px-8 py-2.5 bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {submitting ? '저장 중...' : isEdit ? '수정하기' : '등록하기'}
        </button>
      </div>
    </form>
  );
}
