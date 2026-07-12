'use client';

import { useCallback, useEffect, useState } from 'react';
import { bannerService, type Banner } from '@/features/admin/services/banner-service';
import { toast, toastConfirm } from '@/shared/components/Toast';
import { withTimeout } from '@/shared/utils/withTimeout';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBanners(await withTimeout(bannerService.listAll(), 10000, '배너 조회 지연'));
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
    try {
      await withTimeout(bannerService.softDelete(b.id), 10000, '배너 삭제 지연');
      toast('삭제되었습니다.', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제 실패', 'error');
    }
  };

  const handleToggleActive = async (b: Banner) => {
    try {
      await withTimeout(bannerService.update(b.id, { is_active: !b.is_active }), 10000, '배너 변경 지연');
      toast(b.is_active ? '비활성화됨' : '활성화됨', 'success');
      await load();
    } catch (err) {
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
          initial={editing}
          onCancel={() => { setShowCreate(false); setEditing(null); }}
          onSaved={async () => { setShowCreate(false); setEditing(null); await load(); }}
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
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [linkUrl, setLinkUrl] = useState(initial?.link_url ?? '');
  const [order, setOrder] = useState(initial?.display_order ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [validFrom, setValidFrom] = useState(initial?.valid_from?.slice(0, 16) ?? '');
  const [validUntil, setValidUntil] = useState(initial?.valid_until?.slice(0, 16) ?? '');
  const [imagePathPc, setImagePathPc] = useState(initial?.image_path_pc ?? '');
  const [imagePathMobile, setImagePathMobile] = useState(initial?.image_path_mobile ?? '');
  const [uploadingPc, setUploadingPc] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (file: File, kind: 'pc' | 'mobile') => {
    if (file.size > 5 * 1024 * 1024) { toast('이미지는 5MB 이하', 'error'); return; }
    const setUploading = kind === 'pc' ? setUploadingPc : setUploadingMobile;
    const setPath = kind === 'pc' ? setImagePathPc : setImagePathMobile;
    setUploading(true);
    try {
      const path = await withTimeout(bannerService.uploadImage(file, kind), 20000, '이미지 업로드 지연');
      setPath(path);
      toast(`${kind === 'pc' ? 'PC' : '모바일'} 이미지 업로드 완료`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast('제목을 입력해 주세요', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        link_url: linkUrl.trim() || null,
        display_order: order,
        is_active: isActive,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        image_path_pc: imagePathPc || null,
        image_path_mobile: imagePathMobile || null,
      };
      if (initial) {
        await withTimeout(bannerService.update(initial.id, payload), 10000, '배너 수정 지연');
        toast('수정되었습니다.', 'success');
      } else {
        await withTimeout(bannerService.create(payload), 10000, '배너 등록 지연');
        toast('등록되었습니다.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setSaving(false);
    }
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
          className="input"
        />
      </div>

      {/* PC 이미지 */}
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1.5">PC 이미지 (권장 1920×240)</label>
        {imagePathPc ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerService.publicUrl(imagePathPc)} alt="PC" className="h-16 rounded border border-gray-200" />
            <button type="button" onClick={() => setImagePathPc('')} className="text-xs text-rose-600 font-bold">제거</button>
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'pc'); }}
            disabled={uploadingPc}
            className="text-xs"
          />
        )}
        {uploadingPc && <p className="text-xs text-gray-500 mt-1">업로드 중...</p>}
      </div>

      {/* 모바일 이미지 */}
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1.5">모바일 이미지 (권장 750×400)</label>
        {imagePathMobile ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerService.publicUrl(imagePathMobile)} alt="Mobile" className="h-16 rounded border border-gray-200" />
            <button type="button" onClick={() => setImagePathMobile('')} className="text-xs text-rose-600 font-bold">제거</button>
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'mobile'); }}
            disabled={uploadingMobile}
            className="text-xs"
          />
        )}
        {uploadingMobile && <p className="text-xs text-gray-500 mt-1">업로드 중...</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">노출 시작</label>
          <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">노출 종료</label>
          <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">순서 (작을수록 먼저)</label>
          <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className="input" />
        </div>
        <label className="flex items-end gap-2 cursor-pointer pb-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span className="text-sm text-gray-700">활성화</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-outline text-sm">취소</button>
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? '저장 중...' : initial ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}
