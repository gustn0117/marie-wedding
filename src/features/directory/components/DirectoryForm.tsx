'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';
import { withTimeout } from '@/shared/utils/withTimeout';
import { useImageUpload } from '@/shared/hooks/useImageUpload';
import { usePendingUploads } from '@/shared/hooks/usePendingUploads';
import { isAbortError, mapWithConcurrency, uploadOptimizedImage } from '@/shared/utils/upload';
import { MAX_IMAGE_INPUT_BYTES } from '@/shared/utils/image';
import RichTextEditor from '@/shared/components/RichTextEditor';
import ImageUploadHint from '@/shared/components/ImageUploadHint';
import AccountWithdrawalSection from '@/features/mypage/components/AccountWithdrawalSection';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';
import { validatePhone } from '@/shared/utils/validation';
import { clearMarieProfileCookie } from '@/shared/utils/cookieHelpers';
import { friendlyError } from '@/shared/utils/errorMessages';
import { toast } from '@/shared/components/Toast';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { FieldWarning, fieldWrapClass } from '@/shared/components/FieldWarning';
import type { Profile } from '@/types/database';

const COMPANY_SIZES = [
  { value: 'private', label: '비공개' },
  { value: '1-5', label: '1~5명' },
  { value: '6-10', label: '6~10명' },
  { value: '11-30', label: '11~30명' },
  { value: '31-50', label: '31~50명' },
  { value: '51-100', label: '51~100명' },
  { value: '100+', label: '100명 이상' },
];

const MAX_GALLERY_ACTIVE_SOURCE_BYTES = 60 * 1024 * 1024;
const GALLERY_BATCH_TIMEOUT_MS = 60_000;
const GALLERY_QUEUE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22 viewBox=%220 0 800 600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23f3f4f6%22/%3E%3Cpath d=%22M300 330l75-85 65 72 42-48 88 101H260z%22 fill=%22%23d1d5db%22/%3E%3Ccircle cx=%22475%22 cy=%22215%22 r=%2230%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E';

interface DirectoryFormProps {
  profile: Profile;
}

interface GalleryUploadItem {
  id: string;
  path: string | null;
  preview: string;
  status: 'done' | 'uploading' | 'error';
  progress: number;
  file?: File;
  error?: string;
  localUrl?: boolean;
}

export default function DirectoryForm({ profile }: DirectoryFormProps) {
  const router = useRouter();
  const [listed, setListed] = useState(profile.is_directory_listed);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);
  const [savingStep, setSavingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { fieldError, setFieldError, showFieldIssue } = useFieldError('dirfield');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormDataRaw] = useState({
    contact_name: profile.contact_name || '',
    company_name: profile.company_name || '',
    business_type: profile.business_type || '',
    region: (profile.region || '') as string,
    bio: profile.bio || '',
    phone: profile.phone || '',
    website: profile.website || '',
    company_size: profile.company_size || '',
    established_year: profile.established_year || '',
    address: profile.address || '',
  });
  // 어떤 필드든 편집하면 그 자리의 검증 경고를 지운다(누락 필드 재입력 즉시 반영).
  const setFormData = (v: Parameters<typeof setFormDataRaw>[0]) => { setFieldError(null); setFormDataRaw(v); };
  const bioRef = useRef(formData.bio);
  const { trackUpload, waitForUploads, pendingCount } = usePendingUploads();

  const avatarUpload = useImageUpload({
    initialPath: profile.profile_image,
    initialUrl: resolveStorageUrl(profile.profile_image, 'avatars'),
    bucket: 'avatars',
    maxDimension: 640,
    maxSizeMB: 0.45,
    quality: 0.84,
    buildPath: (file) => `${profile.user_id}/avatar_${Date.now()}_${crypto.randomUUID()}.${file.name.split('.').pop() || 'webp'}`,
  });
  const coverUpload = useImageUpload({
    initialPath: profile.cover_image,
    initialUrl: resolveStorageUrl(profile.cover_image, 'avatars'),
    bucket: 'avatars',
    maxDimension: 1280,
    maxSizeMB: 0.8,
    quality: 0.82,
    buildPath: (file) => `${profile.user_id}/cover_${Date.now()}_${crypto.randomUUID()}.${file.name.split('.').pop() || 'webp'}`,
  });
  const initialGalleryItems: GalleryUploadItem[] = (profile.gallery || []).map<GalleryUploadItem>((path) => ({
    id: `existing:${path}`,
    path,
    preview: resolveStorageUrl(path, 'avatars') ?? '',
    status: 'done',
    progress: 100,
  })).filter((item) => !!item.preview);
  const [galleryItems, setGalleryItemsState] = useState<GalleryUploadItem[]>(initialGalleryItems);
  const galleryItemsRef = useRef(initialGalleryItems);
  const galleryControllersRef = useRef(new Map<string, AbortController>());
  const galleryObjectUrlsRef = useRef(new Set<string>());
  const galleryBatchesRef = useRef(new Set<Promise<void>>());
  const galleryMountedRef = useRef(true);

  const setGalleryItems = (updater: (previous: GalleryUploadItem[]) => GalleryUploadItem[]) => {
    // 업로드 콜백·삭제·저장이 같은 tick에 겹쳐도 저장은 항상 최신 목록을 읽는다.
    const next = updater(galleryItemsRef.current);
    galleryItemsRef.current = next;
    setGalleryItemsState(next);
  };

  const patchGalleryItem = (id: string, patch: Partial<GalleryUploadItem>) => {
    if (!galleryMountedRef.current) return;
    setGalleryItems((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (saveLockRef.current) {
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return; }
    setError(null);
    avatarUpload.selectFile(file);
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    if (saveLockRef.current) return;
    avatarUpload.remove();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (saveLockRef.current) {
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return; }
    setError(null);
    coverUpload.selectFile(file);
    e.target.value = '';
  };

  const handleRemoveCover = () => {
    if (saveLockRef.current) return;
    coverUpload.remove();
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (saveLockRef.current) {
      e.target.value = '';
      return;
    }
    const available = Math.max(0, 12 - galleryItemsRef.current.length);
    const candidates = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    const selected = candidates.filter((file) => file.size > 0 && file.size <= MAX_IMAGE_INPUT_BYTES);
    const activeSourceBytes = galleryItemsRef.current.reduce(
      (sum, item) => sum + (item.file?.size ?? 0),
      0,
    );
    let remainingBytes = Math.max(0, MAX_GALLERY_ACTIVE_SOURCE_BYTES - activeSourceBytes);
    const files: File[] = [];
    for (const file of selected) {
      if (files.length >= available) break;
      if (file.size > remainingBytes) continue;
      files.push(file);
      remainingBytes -= file.size;
    }
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    const selectionError = selected.length < candidates.length
      ? '갤러리 사진은 비어 있지 않은 30MB 이하 이미지만 올릴 수 있어요.'
      : files.length < selected.length
        ? '갤러리는 최대 12장, 처리 중 원본 합계 60MB까지 추가할 수 있어요.'
        : null;
    setError(selectionError);
    if (files.length === 0) return;
    const newItems = files.map<GalleryUploadItem>((file) => ({
      id: crypto.randomUUID(),
      path: null,
      // 원본은 미리보기로 디코드하지 않고 작은 자리표시자를 즉시 렌더한다.
      // 업로드 완료 뒤에만 실제 전송된 작은 압축본으로 교체한다.
      preview: GALLERY_QUEUE_PLACEHOLDER,
      localUrl: false,
      status: 'uploading',
      progress: 1,
      file,
    }));
    // 삭제/페이지 이탈이 worker 시작 전이어도 취소되도록 controller를 큐 등록 전에 만든다.
    newItems.forEach((item) => galleryControllersRef.current.set(item.id, new AbortController()));
    setGalleryItems((items) => [...items, ...newItems]);

    const batch = (async () => {
      let batchTimedOut = false;
      const timeoutMessage = '갤러리 사진 일괄 업로드가 1분을 초과해 취소되었습니다.';
      const batchTimer = window.setTimeout(() => {
        batchTimedOut = true;
        newItems.forEach((item) => galleryControllersRef.current.get(item.id)?.abort(
          new DOMException(timeoutMessage, 'AbortError'),
        ));
      }, GALLERY_BATCH_TIMEOUT_MS);
      let results: PromiseSettledResult<void>[];
      try {
        results = await mapWithConcurrency(newItems, 3, async (item) => {
        const controller = galleryControllersRef.current.get(item.id);
        if (!controller) return;
        try {
          if (controller.signal.aborted) {
            throw controller.signal.reason
              ?? new DOMException('사진 업로드가 취소되었습니다.', 'AbortError');
          }
          const queuedItem = galleryItemsRef.current.find((candidate) => candidate.id === item.id);
          if (!queuedItem) {
            controller.abort();
            throw new DOMException('사진 업로드가 취소되었습니다.', 'AbortError');
          }
          patchGalleryItem(item.id, { status: 'uploading', progress: 1, error: undefined });
          const result = await uploadOptimizedImage(item.file!, {
            bucket: 'avatars',
            maxDimension: 1280,
            maxSizeMB: 0.75,
            quality: 0.82,
            signal: controller.signal,
            buildPath: (file) => `${profile.user_id}/gallery_${Date.now()}_${crypto.randomUUID()}.${file.name.split('.').pop() || 'webp'}`,
            onUploadProgress: (progress) => patchGalleryItem(item.id, { progress: progress.percent }),
            onCompressedPreview: (compressed) => {
              if (!galleryMountedRef.current || controller.signal.aborted) return;
              const current = galleryItemsRef.current.find((candidate) => candidate.id === item.id);
              if (!current) return;
              if (current.localUrl) {
                URL.revokeObjectURL(current.preview);
                galleryObjectUrlsRef.current.delete(current.preview);
              }
              const optimizedUrl = URL.createObjectURL(compressed);
              galleryObjectUrlsRef.current.add(optimizedUrl);
              patchGalleryItem(item.id, { preview: optimizedUrl, localUrl: true });
            },
          });
          if (!galleryMountedRef.current || controller.signal.aborted) return;
          const current = galleryItemsRef.current.find((candidate) => candidate.id === item.id);
          if (!current) return;
          let optimizedPreview = current.preview;
          let localUrl = current.localUrl ?? false;
          if (!localUrl) {
            optimizedPreview = URL.createObjectURL(result.file);
            galleryObjectUrlsRef.current.add(optimizedPreview);
            localUrl = true;
          }
          patchGalleryItem(item.id, {
            path: result.path,
            preview: optimizedPreview,
            localUrl,
            status: 'done',
            progress: 100,
            // 재시도에 필요 없는 대용량 원본 File 참조를 즉시 놓는다. 화면에는
            // 실제 전송된 작은 압축본 Blob만 유지한다.
            file: undefined,
          });
        } catch (uploadError) {
          if (!isAbortError(uploadError) || batchTimedOut) {
            patchGalleryItem(item.id, {
              status: 'error',
              error: batchTimedOut
                ? timeoutMessage
                : uploadError instanceof Error ? uploadError.message : '업로드 실패',
            });
          }
          if (!isAbortError(uploadError)) throw uploadError;
        } finally {
          galleryControllersRef.current.delete(item.id);
        }
        });
      } finally {
        window.clearTimeout(batchTimer);
      }
      results.forEach((result, index) => {
        if (result.status !== 'rejected') return;
        patchGalleryItem(newItems[index].id, {
          status: 'error',
          error: result.reason instanceof Error ? result.reason.message : '업로드 실패',
        });
      });
      if (batchTimedOut && galleryMountedRef.current) setError(timeoutMessage);
    })();
    galleryBatchesRef.current.add(batch);
    try {
      await batch;
    } finally {
      galleryBatchesRef.current.delete(batch);
    }
  };

  const retryGalleryItem = (id: string) => {
    if (saveLockRef.current) return;
    const item = galleryItemsRef.current.find((candidate) => candidate.id === id);
    if (!item?.file) return;
    const fakeInput = { target: { files: [item.file], value: '' } };
    // 실패 항목을 제거한 뒤 동일 파일을 일반 큐에 다시 넣는다.
    handleRemoveGalleryItem(galleryItemsRef.current.findIndex((candidate) => candidate.id === id));
    void handleGallerySelect(fakeInput as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const handleRemoveGalleryItem = (idx: number) => {
    if (saveLockRef.current) return;
    const item = galleryItemsRef.current[idx];
    if (!item) return;
    galleryControllersRef.current.get(item.id)?.abort();
    galleryControllersRef.current.delete(item.id);
    if (item.localUrl) {
      URL.revokeObjectURL(item.preview);
      galleryObjectUrlsRef.current.delete(item.preview);
    }
    setGalleryItems((items) => items.filter((candidate) => candidate.id !== item.id));
  };

  useEffect(() => {
    const controllers = galleryControllersRef.current;
    const objectUrls = galleryObjectUrlsRef.current;
    galleryMountedRef.current = true;
    return () => {
      galleryMountedRef.current = false;
      controllers.forEach((controller) => controller.abort());
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  const galleryUploading = galleryItems.filter((item) => item.status === 'uploading').length;

  const handleToggle = async () => {
    if (!listed && !formData.region) { setError('지역을 1개 이상 선택해주세요.'); return; }
    // 낙관적: 즉시 토글 반영, 서버는 백그라운드. 실패 시 롤백.
    const nextListed = !listed;
    setListed(nextListed);
    setSubmitting(true);
    setError(null);
    try {
      await directoryService.toggleDirectoryListing(profile.id, nextListed);
      clearMarieProfileCookie();
      router.refresh();
      setSubmitting(false);
    } catch (err) {
      setListed(!nextListed);
      setError(friendlyError(err, '처리에 실패했습니다.'));
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (saveLockRef.current) return;
    // 클라이언트 유효성 검사 — 누락 필드로 스크롤 + 그 자리에 경고
    if (!formData.business_type) {
      showFieldIssue({ field: 'business_type', message: '업종을 1개 이상 선택해주세요.' });
      return;
    }
    if (!formData.region) {
      showFieldIssue({ field: 'region', message: '지역을 1개 이상 선택해주세요. 지역 카드를 눌러 활성화하세요.' });
      return;
    }
    if (formData.phone.trim().length > 0) {
      const phoneCheck = validatePhone(formData.phone);
      if (!phoneCheck.valid) {
        showFieldIssue({ field: 'phone', message: phoneCheck.reason ?? '연락처를 정확히 입력해주세요.' });
        return;
      }
    }

    saveLockRef.current = true;
    setSaving(true);
    setError(null);
    setSuccess(false);
    const startedAt = performance.now();
    try {
      setSavingStep(
        avatarUpload.uploading || coverUpload.uploading || galleryUploading > 0 || pendingCount > 0
          ? '사진 마무리 중...'
          : '저장 중...',
      );
      const [profileImagePath, coverImagePath] = await Promise.all([
        avatarUpload.waitForUpload(),
        coverUpload.waitForUpload(),
        Promise.all(Array.from(galleryBatchesRef.current)),
        waitForUploads(),
      ]);
      const failedGalleryItem = galleryItemsRef.current.find((item) => item.status === 'error');
      if (failedGalleryItem) {
        throw new Error('업로드에 실패한 갤러리 사진이 있습니다. 다시 시도하거나 삭제한 뒤 저장해주세요.');
      }
      const galleryPaths = galleryItemsRef.current
        .filter((item) => item.status === 'done' && item.path)
        .map((item) => item.path as string);
      await withTimeout(
        directoryService.updateProfile(profile.id, {
          contact_name: formData.contact_name.trim() || undefined,
          company_name: formData.company_name.trim() || null,
          business_type: formData.business_type || null,
          region: formData.region,
          bio: bioRef.current.trim() || null,
          phone: formData.phone.trim() || null,
          website: formData.website.trim() || null,
          profile_image: profileImagePath,
          cover_image: coverImagePath,
          company_size: formData.company_size || null,
          established_year: formData.established_year || null,
          address: formData.address.trim() || null,
          gallery: galleryPaths.length > 0 ? galleryPaths : null,
        }),
        15000,
        '프로필 저장이 너무 오래 걸려요.',
      );

      const elapsed = Math.round(performance.now() - startedAt);
      console.info('[DirectoryForm] save success in', elapsed, 'ms');
      clearMarieProfileCookie();

      // 페이지 리로드 없이 현재 서버 컴포넌트만 갱신 + 저장 완료 토스트
      setSuccess(true);
      setSavingStep(null);
      toast('저장되었습니다.', 'success');
      router.refresh();
      // 저장 배너는 3초 후 자동 해제
      setTimeout(() => setSuccess(false), 3000);
      setSaving(false);
    } catch (err) {
      const elapsed = Math.round(performance.now() - startedAt);
      console.error(`[DirectoryForm] save failed after ${elapsed}ms:`, err);
      setError(friendlyError(err, '저장에 실패했습니다.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSaving(false);
      setSavingStep(null);
    } finally {
      saveLockRef.current = false;
    }
  };

  const togglePill = (field: 'business_type' | 'region', val: string) => {
    const current = formData[field].split(',').filter(Boolean);
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    setFormData(prev => ({ ...prev, [field]: next.join(',') }));
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 bg-state-urgent-bg border-l-4 border-state-urgent flex items-start gap-3">
          <svg className="w-5 h-5 text-state-urgent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-state-urgent">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-state-new-bg border-l-4 border-green-500 flex items-start gap-3">
          <svg className="w-5 h-5 text-state-new shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-state-new">저장되었습니다. 변경 내용이 바로 반영됐습니다.</p>
        </div>
      )}

      <fieldset disabled={saving} className="contents">

      {/* Status Card — 기본 비공개(opt-in). 공개해야 디렉토리·검색에 노출. */}
      <div className={`flex items-center justify-between rounded border-2 p-4 ${listed ? 'border-green-200 bg-state-new-bg/30' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded flex items-center justify-center ${listed ? 'bg-primary' : 'bg-gray-400'}`}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              {listed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              )}
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{listed ? '디렉토리에 공개 중' : '아직 공개되지 않음 (비공개)'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {listed ? '다른 사용자가 검색·인재/업체 프로필 목록에서 내 프로필을 볼 수 있어요' : '공개해야만 검색·인재/업체 프로필 목록에 노출됩니다. 준비되면 공개하세요'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {listed && (
            <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-bold hover:bg-white">
              페이지 보기
            </Link>
          )}
          <button
            onClick={handleToggle}
            disabled={submitting}
            className={`rounded px-4 py-1.5 text-xs font-bold ${
              listed ? 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50' : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {submitting ? '처리 중...' : listed ? '공개 해제' : '디렉토리에 공개'}
          </button>
        </div>
      </div>

      {/* STEP 1: 로고 · 커버 · 업체명 */}
      <Section step={1} title="로고 · 커버 · 업체명" description="로고(정사각)와 커버(가로 배너)를 각각 등록하세요. 디렉토리 카드와 상세 페이지에 표시됩니다.">
        {/* 커버 이미지 — 가로 배너 (상세 페이지 히어로 · 카드 배경) */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            커버 이미지 <span className="text-gray-400 font-normal">(가로 배너)</span>
          </label>
          {coverUpload.preview ? (
            <div className="relative w-full aspect-[16/9] max-h-64 overflow-hidden rounded border border-gray-300 bg-gray-50">
              <img src={coverUpload.preview} alt="" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  aria-label="커버 변경"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/95 shadow ring-1 ring-gray-200 hover:bg-white"
                >
                  <svg className="w-4 h-4 text-gray-800" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  aria-label="커버 삭제"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/95 shadow ring-1 ring-gray-200 hover:bg-state-urgent hover:text-white text-state-urgent"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="w-full aspect-[16/9] max-h-48 rounded border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary-50/30 transition-colors flex flex-col items-center justify-center gap-1.5 px-3"
            >
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
              </svg>
              <p className="text-sm font-bold text-gray-700">커버 이미지 등록</p>
              <p className="text-[11px] text-gray-400 text-center leading-tight">
                권장 1600×900px (16:9)<br />JPG · PNG · 자동 압축
              </p>
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
          {coverUpload.uploading && (
            <div className="mt-2" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-primary transition-[width]" style={{ width: `${coverUpload.progress?.percent ?? 1}%` }} /></div>
              <p className="mt-1 text-xs font-medium text-primary">{coverUpload.statusText}</p>
            </div>
          )}
          {coverUpload.error && <p className="mt-1 text-xs text-state-urgent">{coverUpload.error}</p>}
          <p className="text-[11px] text-gray-500 mt-2 leading-snug">
            상세 페이지 상단·디렉토리 카드에 표시되는 가로 배너입니다.<br />
            <b>1600×900px</b> (16:9 가로) 권장 · JPG/PNG · 자동 압축
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              로고 <span className="text-gray-400 font-normal">(정사각)</span>
            </label>
            {avatarUpload.preview ? (
              <div className="relative w-full aspect-square overflow-hidden rounded border border-gray-300 bg-gray-50">
                <img src={avatarUpload.preview} alt="" className="w-full h-full object-cover" />
                {/* 액션은 모바일에서도 항상 보이도록 우상단 아이콘 버튼으로. 큰 hover overlay 는 desktop 만 */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="썸네일 변경"
                    className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/95 shadow ring-1 ring-gray-200 hover:bg-white"
                  >
                    <svg className="w-4 h-4 text-gray-800" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    aria-label="썸네일 삭제"
                    className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/95 shadow ring-1 ring-gray-200 hover:bg-state-urgent hover:text-white text-state-urgent"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square rounded border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary-50/30 transition-colors flex flex-col items-center justify-center gap-1.5 px-3"
              >
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                </svg>
                <p className="text-sm font-bold text-gray-700">로고 등록</p>
                <p className="text-[11px] text-gray-400 text-center leading-tight">
                  권장 800×800px<br />JPG · PNG · 자동 압축
                </p>
              </button>
            )}
            <p className="text-[11px] text-gray-500 mt-2 leading-snug">
              업체 상징(로고 또는 담당자 사진)입니다.<br />
              <b>800×800px</b> 정사각 권장 · JPG/PNG · 자동 압축
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            {avatarUpload.uploading && (
              <div className="mt-2" aria-live="polite">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-primary transition-[width]" style={{ width: `${avatarUpload.progress?.percent ?? 1}%` }} /></div>
                <p className="mt-1 text-xs font-medium text-primary">{avatarUpload.statusText}</p>
              </div>
            )}
            {avatarUpload.error && <p className="mt-1 text-xs text-state-urgent">{avatarUpload.error}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">업체명 / 표시 이름</label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="예) 그랜드 웨딩홀"
              className="w-full rounded border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
            />
            <p className="text-xs text-gray-400 mt-1">디렉토리와 검색 결과에 표시되는 이름입니다.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">담당자 이름</label>
            <input
              type="text"
              value={formData.contact_name}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
              placeholder="예) 김마리"
              className="w-full rounded border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
            />
            <p className="text-xs text-gray-400 mt-1">문의·연락 시 표시되는 담당자명입니다.</p>
          </div>
        </div>
      </Section>

      {/* STEP 2: 업종 & 지역 */}
      <Section step={2} title="업종과 지역을 선택하세요" description="복수 선택이 가능합니다.">
        <div className="space-y-5">
          <FieldRow label="업종" required hint="업체가 제공하는 모든 서비스를 선택하세요 (복수 선택 가능)" id="dirfield-business_type" error={fieldError?.field === 'business_type' ? fieldError.message : undefined}>
            <PillGroup
              options={BUSINESS_TYPES}
              selected={formData.business_type.split(',').filter(Boolean)}
              onToggle={(v) => togglePill('business_type', v)}
            />
          </FieldRow>
          <FieldRow label="활동 지역" required hint="업체가 활동하는 지역을 모두 선택하세요" id="dirfield-region" error={fieldError?.field === 'region' ? fieldError.message : undefined}>
            <PillGroup
              options={REGIONS}
              selected={formData.region.split(',').filter(Boolean)}
              onToggle={(v) => togglePill('region', v)}
            />
          </FieldRow>
        </div>
      </Section>

      {/* STEP 3: 업체 상세 */}
      <Section step={3} title="업체 상세 정보 (선택)" description="자세한 정보를 작성하면 신뢰도가 올라가고 더 많은 관심을 받을 수 있어요.">
        <div className="space-y-5">
          <FieldRow label="업체 규모">
            <div className="flex flex-wrap gap-2">
              {COMPANY_SIZES.map((s) => {
                const active = formData.company_size === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, company_size: active ? '' : s.value }))}
                    className={`rounded px-4 py-2 text-sm font-bold border transition-all ${
                      active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </FieldRow>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FieldRow label="설립연도">
              <input
                type="text"
                value={formData.established_year}
                onChange={(e) => setFormData(prev => ({ ...prev, established_year: e.target.value }))}
                placeholder="예) 2020"
                maxLength={4}
                className="w-full rounded border border-gray-300 px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
              />
            </FieldRow>
            <FieldRow label="연락처" id="dirfield-phone" error={fieldError?.field === 'phone' ? fieldError.message : undefined}>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="010-0000-0000"
                className="w-full rounded border border-gray-300 px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
              />
            </FieldRow>
          </div>

          <FieldRow label="주소">
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="예) 서울 강남구 테헤란로 123"
              className="w-full rounded border border-gray-300 px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
            />
          </FieldRow>

          <FieldRow label="웹사이트">
            <input
              type="text"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://"
              className="w-full rounded border border-gray-300 px-4 py-2.5 text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
            />
          </FieldRow>

          <FieldRow label="업체 소개" hint="글자 굵기, 크기, 목록 등 서식을 사용할 수 있어요">
            <RichTextEditor
              value={formData.bio}
              onChange={(html) => {
                bioRef.current = html;
                setFormData((prev) => ({ ...prev, bio: html }));
              }}
              placeholder="업체 소개, 특장점, 운영 철학 등을 자유롭게 작성해주세요."
              minHeight={180}
              onUploadPromise={trackUpload}
              disabled={saving}
            />
          </FieldRow>
        </div>
      </Section>

      {/* STEP 4: 갤러리 */}
      <Section step={4} title="갤러리 (선택)" description="업체 사진, 작업물, 공간 사진 등을 업로드하면 훨씬 매력적으로 보여요.">
        <div className="mb-3">
          <ImageUploadHint ratio="1:1 (정사각형) 권장" recommendedSize="800 × 800px" maxSize="자동 압축" note="여러 장 동시 선택 가능" />
        </div>
        {galleryItems.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
            {galleryItems.map((item, i) => (
              <div key={item.id} className="relative aspect-square overflow-hidden rounded border border-gray-200">
                <img src={item.preview} alt="" className={`w-full h-full object-cover ${item.status === 'uploading' ? 'opacity-75' : ''}`} />
                {item.status === 'uploading' && (
                  <div className="absolute inset-x-1 bottom-1 rounded bg-black/70 px-1.5 py-1 text-[10px] font-bold text-white">
                    <div className="mb-0.5 h-1 overflow-hidden rounded-full bg-white/30"><div className="h-full bg-white" style={{ width: `${item.progress}%` }} /></div>
                    {item.progress}%
                  </div>
                )}
                {item.status === 'error' && (
                  <button type="button" onClick={() => retryGalleryItem(item.id)} className="absolute inset-x-1 bottom-1 rounded bg-state-urgent px-1.5 py-1 text-[10px] font-bold text-white">
                    실패 · 다시 시도
                  </button>
                )}
                {/* 항상 상시 노출 — 모바일 hover 없음 대응 */}
                <button
                  type="button"
                  onClick={() => handleRemoveGalleryItem(i)}
                  aria-label={`갤러리 ${i + 1}번 이미지 삭제`}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-state-urgent"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={galleryUploading > 0 || galleryItems.length >= 12}
          className="w-full rounded border-2 border-dashed border-gray-300 py-8 text-center hover:border-primary hover:bg-primary-50/30 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <p className="text-sm font-medium text-gray-700">{galleryUploading > 0 ? `${galleryUploading}장 업로드 중` : galleryItems.length >= 12 ? '최대 12장 등록됨' : '사진 추가 (여러 장 가능)'}</p>
        </button>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
      </Section>

      {/* 회원 탈퇴 */}
      <AccountWithdrawalSection />

      {/* Save */}
      <div
        className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <div className="min-w-0 flex-1">
          {saving && savingStep && (
            <p className="truncate text-xs font-medium text-primary" aria-live="polite">
              {savingStep}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={ROUTES.MYPAGE} className="rounded border border-gray-300 px-6 py-3 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary">취소</Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            aria-busy={saving}
            className="rounded bg-primary px-10 py-3 text-sm font-bold text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving
              ? (avatarUpload.uploading || coverUpload.uploading || galleryUploading > 0 || pendingCount > 0
                ? '사진 마무리 중…'
                : '저장 중...')
              : '저장하기'}
          </button>
        </div>
      </div>
      </fieldset>
    </div>
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

function FieldRow({ label, required, hint, children, id, error }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; id?: string; error?: string }) {
  return (
    <div id={id} className={fieldWrapClass(!!error)}>
      <div className="mb-1.5">
        <label className="text-sm font-semibold text-gray-800">
          {label}
          {required && <span className="text-state-urgent ml-0.5">*</span>}
        </label>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {children}
      {error && <FieldWarning message={error} />}
    </div>
  );
}

function PillGroup({ options, selected, onToggle }: {
  options: readonly { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`rounded px-4 py-2 text-sm font-bold border transition-all ${
              active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
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
