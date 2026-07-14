'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BannerCreatePayloadMismatchError,
  bannerService,
  type Banner,
} from '@/features/admin/services/banner-service';
import { toast, toastConfirm } from '@/shared/components/Toast';

function sortBanners(items: Banner[]): Banner[] {
  return [...items].sort((a, b) => (
    a.display_order - b.display_order
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ));
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBanners(await bannerService.listAll());
    } catch (err) {
      toast(err instanceof Error ? err.message : '로드 실패', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (b: Banner) => {
    const ok = await toastConfirm(`'${b.title}' 배너를 삭제할까요? (soft delete)`);
    if (!ok) return;
    setBanners((prev) => prev.filter((item) => item.id !== b.id));
    try {
      await bannerService.softDelete(b.id);
      toast('삭제되었습니다.', 'success');
    } catch (err) {
      setBanners((prev) => sortBanners([...prev.filter((item) => item.id !== b.id), b]));
      toast(err instanceof Error ? err.message : '삭제 실패', 'error');
    }
  };

  const handleToggleActive = async (b: Banner) => {
    setBanners((prev) => prev.map((item) => item.id === b.id ? { ...item, is_active: !b.is_active } : item));
    try {
      const updated = await bannerService.update(b.id, { is_active: !b.is_active });
      setBanners((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      toast(b.is_active ? '비활성화됨' : '활성화됨', 'success');
    } catch (err) {
      setBanners((prev) => prev.map((item) => item.id === b.id ? b : item));
      toast(err instanceof Error ? err.message : '변경 실패', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">배너 관리</h1>
          <p className="page-subtitle">메인페이지 hero 위 배너 등록·노출 관리 (PC / 모바일 분리).</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary text-sm">+ 배너 등록</button>
      </div>

      {(showCreate || editing) && (
        <BannerForm
          key={editing?.id ?? 'create'}
          initial={editing}
          onCancel={() => { setShowCreate(false); setEditing(null); }}
          onSaved={(saved) => {
            setShowCreate(false);
            setEditing(null);
            setBanners((prev) => sortBanners([
              ...prev.filter((item) => item.id !== saved.id),
              saved,
            ]));
          }}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="surface h-28 animate-pulse" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <div className="surface p-12 text-center text-sm text-gray-400">
          등록된 배너가 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {banners.map((b) => {
            const pcUrl = b.image_path_pc ? bannerService.publicUrl(b.image_path_pc) : null;
            const mobileUrl = b.image_path_mobile ? bannerService.publicUrl(b.image_path_mobile) : null;
            return (
              <li key={b.id} className="surface p-4">
                <div className="grid lg:grid-cols-[1fr_auto] gap-4 items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center rounded text-[10px] px-1.5 py-0.5 font-bold border ${b.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {b.is_active ? '활성' : '비활성'}
                      </span>
                      <span className="text-[11px] text-gray-400">순서 {b.display_order}</span>
                      <h3 className="text-sm font-bold text-ink truncate">{b.title}</h3>
                    </div>
                    {b.link_url && <p className="text-xs text-gray-500 truncate mb-2">→ {b.link_url}</p>}
                    {(b.valid_from || b.valid_until) && (
                      <p className="text-[11px] text-gray-500">
                        {b.valid_from && `시작: ${new Date(b.valid_from).toLocaleString('ko-KR')}`}
                        {b.valid_from && b.valid_until && ' · '}
                        {b.valid_until && `종료: ${new Date(b.valid_until).toLocaleString('ko-KR')}`}
                      </p>
                    )}

                    {/* 이미지 미리보기 */}
                    <div className="mt-3 grid sm:grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">PC</p>
                        {pcUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pcUrl} alt="PC" className="w-full h-20 object-cover rounded border border-gray-200 bg-gray-50" />
                        ) : (
                          <div className="w-full h-20 rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">미등록</div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">모바일</p>
                        {mobileUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mobileUrl} alt="모바일" className="w-full h-20 object-cover rounded border border-gray-200 bg-gray-50" />
                        ) : (
                          <div className="w-full h-20 rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">미등록</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex lg:flex-col gap-2 shrink-0">
                    <button type="button" onClick={() => handleToggleActive(b)} className="btn-outline text-xs">
                      {b.is_active ? '비활성화' : '활성화'}
                    </button>
                    <button type="button" onClick={() => setEditing(b)} className="btn-outline text-xs">
                      수정
                    </button>
                    <button type="button" onClick={() => handleDelete(b)} className="text-xs font-semibold text-gray-400 hover:text-rose-600 px-3 py-2">
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BannerForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Banner | null;
  onCancel: () => void;
  onSaved: (banner: Banner) => void;
}) {
  type ImageKind = 'pc' | 'mobile';
  type UploadStage = 'idle' | 'compressing' | 'uploading' | 'error';

  const [title, setTitle] = useState(initial?.title ?? '');
  const [linkUrl, setLinkUrl] = useState(initial?.link_url ?? '');
  const [order, setOrder] = useState(initial?.display_order ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [validFrom, setValidFrom] = useState(initial?.valid_from?.slice(0, 16) ?? '');
  const [validUntil, setValidUntil] = useState(initial?.valid_until?.slice(0, 16) ?? '');
  const [imagePathPc, setImagePathPc] = useState(initial?.image_path_pc ?? '');
  const [imagePathMobile, setImagePathMobile] = useState(initial?.image_path_mobile ?? '');
  const [previewPc, setPreviewPc] = useState<string | null>(null);
  const [previewMobile, setPreviewMobile] = useState<string | null>(null);
  const [stagePc, setStagePc] = useState<UploadStage>('idle');
  const [stageMobile, setStageMobile] = useState<UploadStage>('idle');
  const [progressPc, setProgressPc] = useState(0);
  const [progressMobile, setProgressMobile] = useState(0);
  const [errorPc, setErrorPc] = useState<string | null>(null);
  const [errorMobile, setErrorMobile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(false);
  const saveLockRef = useRef(false);
  const savePhaseRef = useRef<'idle' | 'waiting_uploads' | 'saving_record'>('idle');
  const generationRef = useRef<Record<ImageKind, number>>({ pc: 0, mobile: 0 });
  const pathRef = useRef<Record<ImageKind, string>>({
    pc: initial?.image_path_pc ?? '',
    mobile: initial?.image_path_mobile ?? '',
  });
  const pendingRef = useRef<Record<ImageKind, Promise<string | null> | null>>({ pc: null, mobile: null });
  const abortRef = useRef<Record<ImageKind, AbortController | null>>({ pc: null, mobile: null });
  const objectUrlRef = useRef<Record<ImageKind, string | null>>({ pc: null, mobile: null });
  const uploadErrorRef = useRef<Record<ImageKind, string | null>>({ pc: null, mobile: null });
  const ownedUploadsRef = useRef(new Set<string>());
  // 생성 요청의 응답만 유실되면 같은 PK로 재시도한다. 성공 전에는 교체하지 않는다.
  const createIdRef = useRef<string | null>(null);

  useEffect(() => {
    const generations = generationRef.current;
    const objectUrls = objectUrlRef.current;
    const ownedUploads = ownedUploadsRef.current;
    const abortControllers = abortRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generations.pc += 1;
      generations.mobile += 1;
      (['pc', 'mobile'] as ImageKind[]).forEach((kind) => {
        abortControllers[kind]?.abort();
        const url = objectUrls[kind];
        if (url) URL.revokeObjectURL(url);
      });

      // DB 저장 응답을 기다리는 중에는 Storage 객체를 지우면 저장된 경로가 깨질 수 있다.
      if (savePhaseRef.current === 'saving_record') return;
      const uncommitted = Array.from(ownedUploads);
      ownedUploads.clear();
      uncommitted.forEach((path) => {
        void bannerService.removeImage(path).catch(() => undefined);
      });
    };
  }, []);

  const assignPath = (kind: ImageKind, path: string) => {
    pathRef.current[kind] = path;
    if (kind === 'pc') setImagePathPc(path);
    else setImagePathMobile(path);
  };

  const assignStage = (kind: ImageKind, stage: UploadStage) => {
    if (kind === 'pc') setStagePc(stage);
    else setStageMobile(stage);
  };

  const assignProgress = (kind: ImageKind, progress: number) => {
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    if (kind === 'pc') setProgressPc(value);
    else setProgressMobile(value);
  };

  const assignError = (kind: ImageKind, message: string | null) => {
    uploadErrorRef.current[kind] = message;
    if (kind === 'pc') setErrorPc(message);
    else setErrorMobile(message);
  };

  const assignPreview = (kind: ImageKind, url: string | null) => {
    const previous = objectUrlRef.current[kind];
    if (previous) URL.revokeObjectURL(previous);
    objectUrlRef.current[kind] = url;
    if (kind === 'pc') setPreviewPc(url);
    else setPreviewMobile(url);
  };

  const handleUpload = (file: File, kind: ImageKind) => {
    const label = kind === 'pc' ? 'PC' : '모바일';
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      const message = 'JPG, PNG, WebP 이미지만 선택할 수 있습니다.';
      assignError(kind, message);
      assignStage(kind, 'error');
      toast(message, 'error');
      return;
    }
    if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
      const message = '원본 이미지는 25MB 이하로 선택해 주세요.';
      assignError(kind, message);
      assignStage(kind, 'error');
      toast(message, 'error');
      return;
    }

    const generation = generationRef.current[kind] + 1;
    generationRef.current[kind] = generation;
    abortRef.current[kind]?.abort();
    const controller = new AbortController();
    abortRef.current[kind] = controller;
    assignError(kind, null);
    assignStage(kind, 'compressing');
    assignProgress(kind, 1);
    assignPreview(kind, null);

    const task = (async (): Promise<string | null> => {
      try {
        const result = await bannerService.uploadImage(
          file,
          kind,
          controller.signal,
          (progress) => {
            if (mountedRef.current && generationRef.current[kind] === generation) {
              assignStage(kind, progress.phase);
              assignProgress(kind, progress.percent);
            }
          },
          (optimized) => {
            if (mountedRef.current && generationRef.current[kind] === generation) {
              assignPreview(kind, URL.createObjectURL(optimized));
            }
          },
        );
        const { path, file: optimized } = result;
        ownedUploadsRef.current.add(path);

        if (!mountedRef.current || generationRef.current[kind] !== generation) {
          ownedUploadsRef.current.delete(path);
          void bannerService.removeImage(path).catch(() => undefined);
          return null;
        }

        // callback이 미리보기를 만들지 못한 경우에도 최종 압축본으로 복구한다.
        assignPreview(kind, URL.createObjectURL(optimized));
        assignPath(kind, path);
        assignStage(kind, 'idle');
        assignProgress(kind, 100);
        toast(`${label} 이미지 준비 완료`, 'success');
        return path;
      } catch (err) {
        const message = err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
        if (mountedRef.current && generationRef.current[kind] === generation) {
          // 실패한 압축본 미리보기를 해제하고 마지막 저장 상태로 되돌린다.
          assignPreview(kind, null);
          assignError(kind, message);
          assignStage(kind, 'error');
          toast(message, 'error');
        }
        return null;
      } finally {
        if (abortRef.current[kind] === controller) abortRef.current[kind] = null;
      }
    })();

    pendingRef.current[kind] = task;
  };

  const clearImage = (kind: ImageKind) => {
    generationRef.current[kind] += 1;
    abortRef.current[kind]?.abort();
    abortRef.current[kind] = null;
    pendingRef.current[kind] = null;
    assignPreview(kind, null);
    assignError(kind, null);
    assignStage(kind, 'idle');
    assignProgress(kind, 0);

    const currentPath = pathRef.current[kind];
    assignPath(kind, '');
    if (currentPath && ownedUploadsRef.current.has(currentPath)) {
      ownedUploadsRef.current.delete(currentPath);
      void bannerService.removeImage(currentPath).catch(() => undefined);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;
    if (!title.trim()) { toast('제목을 입력해 주세요', 'error'); return; }
    if (validFrom && validUntil && new Date(validFrom) > new Date(validUntil)) {
      toast('노출 종료는 시작 이후로 설정해 주세요.', 'error');
      return;
    }

    saveLockRef.current = true;
    savePhaseRef.current = 'waiting_uploads';
    setSaving(true);
    try {
      const generationAtSave = { ...generationRef.current };
      const [uploadedPc, uploadedMobile] = await Promise.all([
        pendingRef.current.pc ?? Promise.resolve(pathRef.current.pc),
        pendingRef.current.mobile ?? Promise.resolve(pathRef.current.mobile),
      ]);
      if (
        generationRef.current.pc !== generationAtSave.pc
        || generationRef.current.mobile !== generationAtSave.mobile
      ) {
        throw new Error('이미지가 변경되었습니다. 다시 저장해 주세요.');
      }
      if (uploadErrorRef.current.pc || uploadErrorRef.current.mobile) {
        throw new Error(uploadErrorRef.current.pc || uploadErrorRef.current.mobile || '이미지를 확인해 주세요.');
      }
      if (pendingRef.current.pc && !uploadedPc) throw new Error('PC 이미지 업로드를 완료하지 못했습니다.');
      if (pendingRef.current.mobile && !uploadedMobile) throw new Error('모바일 이미지 업로드를 완료하지 못했습니다.');

      savePhaseRef.current = 'saving_record';
      const payload = {
        title: title.trim(),
        link_url: linkUrl.trim() || null,
        display_order: order,
        is_active: isActive,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        image_path_pc: uploadedPc || null,
        image_path_mobile: uploadedMobile || null,
      };
      let saved: Banner;
      if (initial) {
        saved = await bannerService.update(initial.id, payload);
        if (mountedRef.current) toast('수정되었습니다.', 'success');
      } else {
        const createId = createIdRef.current ?? crypto.randomUUID();
        createIdRef.current = createId;
        saved = await bannerService.create(payload, createId);
        if (mountedRef.current) toast('등록되었습니다.', 'success');
      }

      // replay라면 최초 commit의 row가 돌아온다. timeout 뒤 사용자가 이미지를
      // 바꿨어도 실제 DB가 참조하는 경로만 보존하고 미참조 업로드는 정리한다.
      const committedPc = initial ? (uploadedPc || null) : saved.image_path_pc;
      const committedMobile = initial ? (uploadedMobile || null) : saved.image_path_mobile;
      if (committedPc) ownedUploadsRef.current.delete(committedPc);
      if (committedMobile) ownedUploadsRef.current.delete(committedMobile);
      const supersededUploads = Array.from(ownedUploadsRef.current);
      ownedUploadsRef.current.clear();
      supersededUploads.forEach((path) => {
        void bannerService.removeImage(path).catch(() => undefined);
      });
      if (initial?.image_path_pc && initial.image_path_pc !== committedPc) {
        void bannerService.removeImage(initial.image_path_pc).catch(() => undefined);
      }
      if (initial?.image_path_mobile && initial.image_path_mobile !== committedMobile) {
        void bannerService.removeImage(initial.image_path_mobile).catch(() => undefined);
      }
      savePhaseRef.current = 'idle';
      if (mountedRef.current) onSaved(saved);
    } catch (err) {
      if (!initial && err instanceof BannerCreatePayloadMismatchError) {
        // 409 응답으로 최초 commit의 실제 이미지 경로가 확정됐다. 현재 초안에서
        // 새로 올렸지만 그 row가 참조하지 않는 객체만 정리한다.
        const committedPaths = new Set([
          err.existingImagePaths.pc,
          err.existingImagePaths.mobile,
        ].filter((path): path is string => !!path));
        const cleanupCandidates = new Set([
          ...Array.from(ownedUploadsRef.current),
          pathRef.current.pc,
          pathRef.current.mobile,
        ].filter(Boolean));
        ownedUploadsRef.current.clear();
        cleanupCandidates.forEach((path) => {
          if (!committedPaths.has(path)) {
            void bannerService.removeImage(path).catch(() => undefined);
          }
        });
      } else if (savePhaseRef.current === 'saving_record') {
        // 쓰기 요청이 timeout/연결 종료된 경우 DB commit 여부는 알 수 없다. 현재 경로를
        // "미사용 업로드"로 보고 지우면 실제로 commit된 배너가 깨질 수 있으므로 보존한다.
        // 이후 저장 성공 시에는 정상 경로로 그대로 확정된다. 실패 시 미참조 객체가
        // 남을 수는 있어도 공개 DB가 삭제된 객체를 가리키는 데이터 손상은 피한다.
        const possiblyCommitted = [pathRef.current.pc, pathRef.current.mobile];
        possiblyCommitted.forEach((path) => {
          if (path) ownedUploadsRef.current.delete(path);
        });
      }
      if (mountedRef.current) toast(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      saveLockRef.current = false;
      savePhaseRef.current = 'idle';
      if (mountedRef.current) setSaving(false);
    }
  };

  const renderImageField = (kind: ImageKind, label: string, recommendation: string) => {
    const path = kind === 'pc' ? imagePathPc : imagePathMobile;
    const localPreview = kind === 'pc' ? previewPc : previewMobile;
    const stage = kind === 'pc' ? stagePc : stageMobile;
    const progress = kind === 'pc' ? progressPc : progressMobile;
    const uploadError = kind === 'pc' ? errorPc : errorMobile;
    const imageUrl = localPreview || (path ? bannerService.publicUrl(path) : null);
    const inputId = `banner-image-${kind}-${initial?.id ?? 'new'}`;

    return (
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1.5">{label} 이미지 ({recommendation})</label>
        {imageUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`${label} 배너 미리보기`} className="h-20 max-w-[70%] rounded border border-gray-200 object-cover" />
            <div className="flex flex-col items-start gap-1.5">
              <label htmlFor={inputId} className="btn-outline cursor-pointer text-xs">이미지 변경</label>
              <button type="button" onClick={() => clearImage(kind)} disabled={saving} className="text-xs text-rose-600 font-bold disabled:opacity-50">제거</button>
            </div>
          </div>
        ) : (
          <label htmlFor={inputId} className="flex h-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-200 text-xs font-semibold text-gray-500 hover:border-primary hover:text-primary">
            이미지 선택
          </label>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const selected = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (selected) handleUpload(selected, kind);
          }}
          disabled={saving}
          className="hidden"
        />
        <div className="mt-1 min-h-4 text-xs" aria-live="polite">
          {stage === 'compressing' && <span className="text-gray-500">이미지 최적화 {progress}% · 미리보기는 바로 반영되었습니다.</span>}
          {stage === 'uploading' && <span className="text-gray-500">업로드 {progress}% · 다른 항목을 계속 입력할 수 있습니다.</span>}
          {stage === 'error' && uploadError && <span className="text-rose-600">{uploadError}</span>}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="surface p-5 space-y-4">
      <h2 className="text-sm font-bold text-ink">{initial ? '배너 수정' : '배너 등록'}</h2>

      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1.5">제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="관리용 라벨 (예: 신규 회원 이벤트)"
          required
          disabled={saving}
          className="input"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1.5">링크 URL (선택)</label>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://... 또는 /events/123"
          disabled={saving}
          className="input"
        />
      </div>

      {renderImageField('pc', 'PC', '1920×240')}
      {renderImageField('mobile', '모바일', '750×400')}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">노출 시작</label>
          <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={saving} className="input" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">노출 종료</label>
          <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={saving} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">순서 (작을수록 먼저)</label>
          <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} disabled={saving} className="input" />
        </div>
        <label className="flex items-end gap-2 cursor-pointer pb-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={saving} />
          <span className="text-sm text-gray-700">활성화</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} disabled={saving} className="btn-outline text-sm disabled:opacity-50">취소</button>
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving
            ? (stagePc === 'compressing' || stagePc === 'uploading' || stageMobile === 'compressing' || stageMobile === 'uploading'
              ? '이미지 마무리 중…'
              : '저장 중…')
            : initial ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}
