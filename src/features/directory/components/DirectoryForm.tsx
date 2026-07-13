'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/shared/utils/image';
import { withTimeout } from '@/shared/utils/withTimeout';
import RichTextEditor from '@/shared/components/RichTextEditor';
import ImageUploadHint from '@/shared/components/ImageUploadHint';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';
import { validatePhone } from '@/shared/utils/validation';
import { clearMarieProfileCookie } from '@/shared/utils/cookieHelpers';
import { friendlyError } from '@/shared/utils/errorMessages';
import { revalidate } from '@/shared/utils/revalidate';
import { toast } from '@/shared/components/Toast';
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

interface DirectoryFormProps {
  profile: Profile;
}

export default function DirectoryForm({ profile }: DirectoryFormProps) {
  const router = useRouter();
  const [listed, setListed] = useState(profile.is_directory_listed);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
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

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    resolveStorageUrl(profile.profile_image, 'avatars')
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    resolveStorageUrl(profile.cover_image, 'avatars')
  );
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>(
    (profile.gallery || []).map(g => resolveStorageUrl(g, 'avatars') ?? '').filter(Boolean)
  );
  const [existingGallery, setExistingGallery] = useState<string[]>(profile.gallery || []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('이미지 크기는 2MB 이하여야 합니다.'); return; }
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('커버 이미지는 5MB 이하여야 합니다.'); return; }
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 5 * 1024 * 1024 && f.type.startsWith('image/'));
    if (valid.length < files.length) setError('5MB 이하의 이미지만 업로드 가능합니다.');
    setGalleryFiles(prev => [...prev, ...valid]);
    setGalleryPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleRemoveGalleryItem = (idx: number) => {
    const isExisting = idx < existingGallery.length;
    if (isExisting) {
      setExistingGallery(prev => prev.filter((_, i) => i !== idx));
      setGalleryPreviews(prev => prev.filter((_, i) => i !== idx));
    } else {
      const fileIdx = idx - existingGallery.length;
      setGalleryFiles(prev => prev.filter((_, i) => i !== fileIdx));
      setGalleryPreviews(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleToggle = async () => {
    if (!listed && !formData.region) { setError('지역을 1개 이상 선택해주세요.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await directoryService.toggleDirectoryListing(profile.id, !listed);
      setListed(!listed);
      clearMarieProfileCookie();
      window.location.reload();
    } catch (err) {
      setError(friendlyError(err, '처리에 실패했습니다.'));
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    // 클라이언트 유효성 검사 — 서버 왕복 없이 즉시 피드백
    if (!formData.region) {
      setError('지역을 1개 이상 선택해주세요. 지역 카드를 눌러 활성화하세요.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!formData.business_type) {
      setError('업종을 1개 이상 선택해주세요.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (formData.phone.trim().length > 0) {
      const phoneCheck = validatePhone(formData.phone);
      if (!phoneCheck.valid) {
        setError(phoneCheck.reason ?? '연락처를 정확히 입력해주세요.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    const startedAt = performance.now();
    try {
      const supabase = createClient();
      const galleryCount = galleryFiles.length;

      // 캐시버스팅: URL 이 항상 동일하면 Cloudflare/브라우저가 옛 이미지를 계속 노출.
      // 매 업로드마다 timestamp+random 접미사로 새 경로 → 새 URL 로 저장.
      // 이전 파일은 저장 성공 후 best-effort remove.
      const stampPath = (kind: 'avatar' | 'cover' | 'gallery', i = 0, ext: string) => {
        const stamp = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
        return `${profile.user_id}/${kind}_${stamp}.${ext}`;
      };

      setSavingStep('이미지 업로드 중...');
      let imageFailed = false;

      // 이미지 업로드는 비치명적 — 실패해도 텍스트(업종·지역·소개·연락처 등)는 반드시 저장한다.
      // 실패 시 기존 이미지를 유지(null 아님)하고 imageFailed 로 표시해 저장 후 안내한다.
      const profileImagePromise: Promise<string | null> = (async () => {
        if (!imageFile) return !imagePreview ? null : profile.profile_image;
        try {
          const compressed = await compressImage(imageFile, { maxDimension: 640, quality: 0.8 });
          const ext = compressed.name.split('.').pop() || 'jpg';
          const path = stampPath('avatar', 0, ext);
          const { error: err } = await withTimeout(
            supabase.storage.from('avatars').upload(path, compressed, { upsert: false }),
            20000, '프로필 이미지 업로드 지연',
          );
          if (err) throw err;
          return path;
        } catch (e) {
          console.warn('[DirectoryForm] 로고 업로드 실패, 기존 유지:', e);
          imageFailed = true;
          return profile.profile_image; // 기존 유지
        }
      })();

      const coverImagePromise: Promise<string | null> = (async () => {
        if (!coverFile) return !coverPreview ? null : profile.cover_image;
        try {
          const compressed = await compressImage(coverFile, { maxDimension: 1280, quality: 0.8 });
          const ext = compressed.name.split('.').pop() || 'jpg';
          const path = stampPath('cover', 0, ext);
          const { error: err } = await withTimeout(
            supabase.storage.from('avatars').upload(path, compressed, { upsert: false }),
            20000, '커버 이미지 업로드 지연',
          );
          if (err) throw err;
          return path;
        } catch (e) {
          console.warn('[DirectoryForm] 커버 업로드 실패, 기존 유지:', e);
          imageFailed = true;
          return profile.cover_image;
        }
      })();

      const galleryPromises = galleryFiles.map(async (file, i) => {
        try {
          const compressed = await compressImage(file, { maxDimension: 1280, quality: 0.8 });
          const ext = compressed.name.split('.').pop() || 'jpg';
          const path = stampPath('gallery', i, ext);
          const { error: err } = await withTimeout(
            supabase.storage.from('avatars').upload(path, compressed, { upsert: false }),
            20000, `갤러리 ${i + 1}번째 업로드 지연`,
          );
          if (err) throw err;
          return path;
        } catch (e) {
          console.warn(`[DirectoryForm] 갤러리 ${i + 1} 업로드 실패, 건너뜀:`, e);
          imageFailed = true;
          return null; // 실패한 갤러리 이미지는 제외
        }
      });

      const [profileImage, coverImage, ...newGalleryRaw] = await Promise.all([
        profileImagePromise,
        coverImagePromise,
        ...galleryPromises,
      ]);
      const newGallery = newGalleryRaw.filter((p): p is string => !!p);

      const uploadedGallery = [...existingGallery, ...newGallery];
      setSavingStep(galleryCount > 0 ? `프로필 정보 저장 중... (이미지 ${galleryCount + Number(!!imageFile) + Number(!!coverFile)}장 처리 완료)` : '프로필 정보 저장 중...');

      await withTimeout(
        directoryService.updateProfile(profile.id, {
          company_name: formData.company_name.trim() || null,
          business_type: formData.business_type || null,
          region: formData.region,
          bio: formData.bio.trim() || null,
          phone: formData.phone.trim() || null,
          website: formData.website.trim() || null,
          profile_image: profileImage,
          cover_image: coverImage,
          company_size: formData.company_size || null,
          established_year: formData.established_year || null,
          address: formData.address.trim() || null,
          gallery: uploadedGallery.length > 0 ? uploadedGallery : null,
        }),
        15000,
        '프로필 저장이 너무 오래 걸려요.',
      );

      const elapsed = Math.round(performance.now() - startedAt);
      console.info('[DirectoryForm] save success in', elapsed, 'ms');

      // 이전 이미지 정리 (best-effort — 실패해도 저장 성공에 영향 없음)
      const oldPaths = [
        imageFile && profile.profile_image && profile.profile_image !== profileImage ? profile.profile_image : null,
        coverFile && profile.cover_image && profile.cover_image !== coverImage ? profile.cover_image : null,
      ].filter((v): v is string => !!v);
      if (oldPaths.length > 0) {
        supabase.storage
          .from('avatars')
          .remove(oldPaths)
          .catch((cleanupErr) => console.warn('[DirectoryForm] old image cleanup failed:', cleanupErr));
      }

      // 새 파일 상태 초기화 → 재저장 시 재업로드 안됨
      setImageFile(null);
      setCoverFile(null);
      setGalleryFiles([]);
      // 갤러리 새 항목이 있었다면 existingGallery 를 새 리스트로 교체
      if (newGallery.length > 0) setExistingGallery(uploadedGallery);
      clearMarieProfileCookie();

      // 다른 페이지 서버 캐시 무효화 — 저장 직후 페이지 보기로 이동 시 옛 데이터 뜨는 문제 방지.
      // /directory/[id] · /directory (목록) · /mypage 는 모두 이 프로필의 캐시된 렌더 대상.
      revalidate(ROUTES.DIRECTORY_DETAIL(profile.id), ROUTES.DIRECTORY, ROUTES.MYPAGE).catch(() => {});

      // 페이지 리로드 없이 현재 서버 컴포넌트만 갱신 + 저장 완료 토스트
      setSuccess(true);
      setSavingStep(null);
      if (imageFailed) {
        toast('정보는 저장됐어요. 일부 이미지는 업로드에 실패했으니 다시 시도해주세요.', 'error');
      } else {
        toast('저장되었습니다.', 'success');
      }
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
          <p className="text-sm text-state-new">저장되었습니다. 페이지 이동 중...</p>
        </div>
      )}

      {/* Status Card — 기본 공개. 숨김은 옵션. */}
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
            <p className="text-sm font-bold text-gray-900">{listed ? '디렉토리에 공개 중' : '디렉토리에서 숨김 상태'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {listed ? '다른 사용자가 검색·디렉토리에서 내 업체를 볼 수 있어요' : '내 정보가 검색·디렉토리에 노출되지 않아요. 다시 공개로 전환할 수 있어요'}
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
            {submitting ? '처리 중...' : listed ? '공개 해제' : '다시 공개'}
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
          {coverPreview ? (
            <div className="relative w-full aspect-[16/9] max-h-64 overflow-hidden rounded border border-gray-300 bg-gray-50">
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
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
                권장 1600×900px (16:9)<br />JPG · PNG · 최대 5MB
              </p>
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              로고 <span className="text-gray-400 font-normal">(정사각)</span>
            </label>
            {imagePreview ? (
              <div className="relative w-full aspect-square overflow-hidden rounded border border-gray-300 bg-gray-50">
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
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
                  권장 800×800px<br />JPG · PNG · 최대 2MB
                </p>
              </button>
            )}
            <p className="text-[11px] text-gray-500 mt-2 leading-snug">
              업체 상징(로고 또는 담당자 사진)입니다.<br />
              <b>800×800px</b> 정사각 권장 · JPG/PNG · 최대 2MB
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
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
        </div>
      </Section>

      {/* STEP 2: 업종 & 지역 */}
      <Section step={2} title="업종과 지역을 선택하세요" description="복수 선택이 가능합니다.">
        <div className="space-y-5">
          <FieldRow label="업종" hint="업체가 제공하는 모든 서비스를 선택하세요 (복수 선택 가능)">
            <PillGroup
              options={BUSINESS_TYPES}
              selected={formData.business_type.split(',').filter(Boolean)}
              onToggle={(v) => togglePill('business_type', v)}
            />
          </FieldRow>
          <FieldRow label="활동 지역" required hint="업체가 활동하는 지역을 모두 선택하세요">
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
            <FieldRow label="연락처">
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
              onChange={(html) => setFormData(prev => ({ ...prev, bio: html }))}
              placeholder="업체 소개, 특장점, 운영 철학 등을 자유롭게 작성해주세요."
              minHeight={180}
            />
          </FieldRow>
        </div>
      </Section>

      {/* STEP 4: 갤러리 */}
      <Section step={4} title="갤러리 (선택)" description="업체 사진, 작업물, 공간 사진 등을 업로드하면 훨씬 매력적으로 보여요.">
        <div className="mb-3">
          <ImageUploadHint ratio="1:1 (정사각형) 권장" recommendedSize="800 × 800px" maxSize="5MB" note="여러 장 동시 선택 가능" />
        </div>
        {galleryPreviews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
            {galleryPreviews.map((src, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded border border-gray-200">
                <img src={src} alt="" className="w-full h-full object-cover" />
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
          className="w-full rounded border-2 border-dashed border-gray-300 py-8 text-center hover:border-primary hover:bg-primary-50/30 transition-colors"
        >
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <p className="text-sm font-medium text-gray-700">사진 추가 (여러 장 가능)</p>
        </button>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
      </Section>

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
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
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
