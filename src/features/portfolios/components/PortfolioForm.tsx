'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Portfolio } from '@/types/database';
import { portfolioService } from '@/features/portfolios/services/portfolioService';
import { toast, toastConfirm } from '@/shared/components/Toast';
import { withTimeout } from '@/shared/utils/withTimeout';



interface Props {
  profileId: string;
  initial?: Portfolio;
}

export default function PortfolioForm({ profileId, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [eventDate, setEventDate] = useState(initial?.event_date ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [venueName, setVenueName] = useState(initial?.venue_name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [coverImage, setCoverImage] = useState<string | null>(initial?.cover_image ?? null);
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const draftIdRef = useRef<string | null>(null);

  async function ensureDraftId(): Promise<string> {
    if (initial) return initial.id;
    if (draftIdRef.current) return draftIdRef.current;
    // 빈 포트폴리오 행을 먼저 만들어서 안정된 ID 확보 → 이미지 path가 진짜 DB 행에 묶임
    const draft = await portfolioService.create({
      profile_id: profileId,
      title: title.trim() || '제목 미정',
      event_date: null,
      role: null,
      venue_name: null,
      description: null,
      images: [],
      cover_image: null,
      is_featured: false,
      display_order: 0,
    });
    draftIdRef.current = draft.id;
    return draft.id;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const id = await ensureDraftId();
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) { setError(`${file.name}: 5MB 초과`); continue; }
        try {
          const path = await withTimeout(
            portfolioService.uploadImage(profileId, id, file),
            20000,
            `${file.name} 업로드가 너무 오래 걸려요.`,
          );
          setImages((prev) => {
            const next = [...prev, path];
            if (!coverImage) setCoverImage(path);
            return next;
          });
        } catch (perFileErr) {
          // 한 파일이 timeout/실패해도 다음 파일은 계속 시도
          setError(perFileErr instanceof Error ? perFileErr.message : `${file.name} 업로드 실패`);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeImage(path: string) {
    setImages((prev) => prev.filter((p) => p !== path));
    if (coverImage === path) setCoverImage(images.find((p) => p !== path) ?? null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return; }
    setBusy(true); setError(null);
    try {
      const payload = {
        profile_id: profileId,
        title: title.trim(),
        event_date: eventDate || null,
        role: role.trim() || null,
        venue_name: venueName.trim() || null,
        description: description.trim() || null,
        images,
        cover_image: coverImage,
        is_featured: isFeatured,
        display_order: initial?.display_order ?? 0,
      };
      const targetId = initial?.id ?? draftIdRef.current;
      if (targetId) {
        await portfolioService.update(targetId, payload);
      } else {
        await portfolioService.create(payload);
      }
      router.push('/mypage/portfolios');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!initial) return;
    const ok = await toastConfirm('이 포트폴리오를 삭제하시겠습니까?');
    if (!ok) return;
    setBusy(true);
    try {
      await portfolioService.softDelete(initial.id);
      toast('삭제되었습니다.', 'success');
      router.push('/mypage/portfolios');
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '삭제 실패';
      toast(msg, 'error');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-bold mb-2 text-gray-900">제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) 그랜드인터컨티넨탈 8월 본식"
          required
          className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2 text-gray-900">진행 일자</label>
          <input
            type="date"
            value={eventDate ?? ''}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 text-gray-900">역할</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="예) 사회자 / 메이크업"
            className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold mb-2 text-gray-900">예식장</label>
        <input
          type="text"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder="예) 그랜드 인터컨티넨탈 서울"
          className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold mb-2 text-gray-900">설명</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="작품의 특징이나 협업 내용을 간단히 적어주세요."
          className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-bold text-gray-900">이미지 ({images.length})</label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs font-bold text-primary hover:underline"
          >
            + 추가
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {images.length === 0 ? (
          <p className="text-xs text-gray-400 border border-dashed border-gray-300 p-4 text-center">
            이미지를 추가해 주세요. 첫 이미지는 자동으로 대표 이미지로 설정됩니다.
          </p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {images.map((path) => (
              <div key={path} className="relative aspect-square border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={portfolioService.publicUrl(path)} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors group">
                  <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setCoverImage(path)}
                      className={`px-1.5 py-0.5 text-[10px] font-bold ${coverImage === path ? 'bg-primary text-white' : 'bg-white text-gray-700'}`}
                    >
                      {coverImage === path ? '대표' : '대표로'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(path)}
                      className="px-1.5 py-0.5 bg-white text-[10px] font-bold text-state-urgent"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
        />
        <span>대표 포트폴리오로 강조</span>
      </label>

      {error && <p className="text-sm text-state-urgent">{error}</p>}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        {initial ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="text-sm text-gray-500 hover:text-state-urgent disabled:opacity-50"
          >
            삭제
          </button>
        ) : <span />}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary min-h-[44px] px-6 disabled:opacity-50"
        >
          {busy ? '저장 중…' : initial ? '수정 저장' : '등록'}
        </button>
      </div>
    </form>
  );
}
