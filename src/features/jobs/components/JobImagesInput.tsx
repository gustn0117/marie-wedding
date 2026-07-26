'use client';

import { useCallback, useRef, useState } from 'react';
import { uploadOptimizedImage, isAbortError } from '@/shared/utils/upload';
import { MAX_IMAGE_INPUT_BYTES } from '@/shared/utils/image';

export const JOB_IMAGES_MAX = 8;
const BUCKET = 'job-images';

export function jobImageUrl(path: string): string {
  const safe = path.split('/').map(encodeURIComponent).join('/');
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${safe}`;
}

interface Slot {
  key: string;
  path: string | null;   // 업로드 완료 시 확정
  preview: string;       // objectURL(업로드 중) 또는 공개 URL
  uploading: boolean;
  error: string | null;
}

interface JobImagesInputProps {
  value: string[];
  onChange: (paths: string[]) => void;
  /** 업로드 진행 중인 Promise 를 폼에 알려 제출 전 대기시킨다. */
  onUploadPromise?: (p: Promise<unknown>) => void;
  disabled?: boolean;
}

/**
 * 공고 추가 사진(갤러리) 입력 — 최대 8장.
 * 대표 이미지(useImageUpload)와 같은 압축·업로드 경로를 쓰되 여러 장을 다룬다.
 * 업로드가 끝난 순서가 아니라 사용자가 고른 순서를 유지한다.
 */
export default function JobImagesInput({ value, onChange, onUploadPromise, disabled }: JobImagesInputProps) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    value.map((p, i) => ({ key: `init-${i}-${p}`, path: p, preview: jobImageUrl(p), uploading: false, error: null })),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // 슬롯 상태를 갱신하고, 업로드가 끝난 경로만 순서대로 부모에 넘긴다.
  const commit = useCallback((next: Slot[]) => {
    slotsRef.current = next;
    setSlots(next);
    onChange(next.filter((s) => s.path).map((s) => s.path as string));
  }, [onChange]);

  const patch = useCallback((key: string, updater: (s: Slot) => Slot) => {
    commit(slotsRef.current.map((s) => (s.key === key ? updater(s) : s)));
  }, [commit]);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = JOB_IMAGES_MAX - slotsRef.current.length;
    if (room <= 0) return;
    const picked = Array.from(files).slice(0, room);

    const created: Slot[] = picked.map((file, i) => ({
      key: `${Date.now()}-${i}-${Math.round(Math.random() * 1e6)}`,
      path: null,
      preview: URL.createObjectURL(file),
      uploading: true,
      error: null,
    }));
    commit([...slotsRef.current, ...created]);

    picked.forEach((file, i) => {
      const slot = created[i];
      if (file.size > MAX_IMAGE_INPUT_BYTES) {
        patch(slot.key, (s) => ({ ...s, uploading: false, error: '파일이 너무 큽니다' }));
        return;
      }
      const task = uploadOptimizedImage(file, {
        bucket: BUCKET,
        maxDimension: 1600,
        maxSizeMB: 0.9,
        quality: 0.82,
        buildPath: (compressed) =>
          `gallery/${Date.now()}_${crypto.randomUUID()}.${compressed.name.split('.').pop() || 'webp'}`,
      })
        .then(({ path }) => {
          patch(slot.key, (s) => ({ ...s, path, uploading: false, preview: jobImageUrl(path) }));
        })
        .catch((err) => {
          if (isAbortError(err)) return;
          patch(slot.key, (s) => ({ ...s, uploading: false, error: '업로드 실패' }));
        });
      onUploadPromise?.(task);
    });
  }, [commit, patch, onUploadPromise]);

  const remove = (key: string) => commit(slotsRef.current.filter((s) => s.key !== key));

  const move = (key: string, dir: -1 | 1) => {
    const list = [...slotsRef.current];
    const i = list.findIndex((s) => s.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit(list);
  };

  const full = slots.length >= JOB_IMAGES_MAX;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold text-gray-800">
          추가 사진 <span className="ml-2 text-[11px] font-normal text-gray-400">선택</span>
        </label>
        <span className="text-[11px] text-gray-400 tabular-nums">{slots.length}/{JOB_IMAGES_MAX}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((s, i) => (
          <div key={s.key} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.preview} alt={`추가 사진 ${i + 1}`} className={`h-full w-full object-cover ${s.uploading ? 'opacity-50' : ''}`} />
            {s.uploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold text-gray-600">올리는 중…</span>
              </div>
            )}
            {s.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-state-urgent-bg/80">
                <span className="text-[11px] font-bold text-state-urgent">{s.error}</span>
              </div>
            )}
            {!disabled && (
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button type="button" onClick={() => move(s.key, -1)} disabled={i === 0} aria-label={`${i + 1}번째 사진 앞으로`}
                  className="px-1.5 text-xs font-bold text-white disabled:opacity-30">←</button>
                <button type="button" onClick={() => remove(s.key)} aria-label={`${i + 1}번째 사진 삭제`}
                  className="px-1.5 text-xs font-bold text-white">삭제</button>
                <button type="button" onClick={() => move(s.key, 1)} disabled={i === slots.length - 1} aria-label={`${i + 1}번째 사진 뒤로`}
                  className="px-1.5 text-xs font-bold text-white disabled:opacity-30">→</button>
              </div>
            )}
          </div>
        ))}

        {!full && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-primary hover:text-primary"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-[11px] font-semibold">사진 추가</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
      <p className="mt-1 text-[11px] text-gray-400">
        홀·근무 환경 사진을 최대 {JOB_IMAGES_MAX}장까지 올릴 수 있어요. 공고 상세 하단에 순서대로 표시됩니다.
      </p>
    </div>
  );
}
