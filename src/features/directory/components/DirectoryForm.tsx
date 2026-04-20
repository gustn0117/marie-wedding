'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';
import { createClient } from '@/lib/supabase/client';
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
  const [listed, setListed] = useState(profile.is_directory_listed);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    profile.profile_image
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
      : null
  );

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>(
    (profile.gallery || []).map(g => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${g}`)
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
      document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했습니다.');
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.region) { setError('지역을 1개 이상 선택해주세요.'); return; }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const supabase = createClient();

      let profileImage = profile.profile_image;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${profile.user_id}/avatar.${ext}`;
        const { error: err } = await supabase.storage.from('avatars').upload(path, imageFile, { upsert: true });
        if (err) throw new Error('프로필 이미지 업로드 실패');
        profileImage = path;
      } else if (!imagePreview) {
        profileImage = null;
      }

      const uploadedGallery = [...existingGallery];
      for (const file of galleryFiles) {
        const ext = file.name.split('.').pop();
        const path = `${profile.user_id}/gallery_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: err } = await supabase.storage.from('avatars').upload(path, file);
        if (err) throw new Error('갤러리 이미지 업로드 실패');
        uploadedGallery.push(path);
      }

      await directoryService.updateProfile(profile.id, {
        company_name: formData.company_name.trim() || null,
        business_type: formData.business_type || null,
        region: formData.region,
        bio: formData.bio.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        profile_image: profileImage,
        company_size: formData.company_size || null,
        established_year: formData.established_year || null,
        address: formData.address.trim() || null,
        gallery: uploadedGallery.length > 0 ? uploadedGallery : null,
      });

      document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      setSuccess(true);
      setTimeout(() => { window.location.href = ROUTES.DIRECTORY_DETAIL(profile.id); }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const togglePill = (field: 'business_type' | 'region', val: string) => {
    const current = formData[field].split(',').filter(Boolean);
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    setFormData(prev => ({ ...prev, [field]: next.join(',') }));
  };

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 text-green-600 text-sm">저장되었습니다.</div>}

      {/* Status Bar */}
      <div className="flex items-center justify-between py-3 border-t border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 text-xs font-semibold ${listed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {listed ? '등록됨' : '미등록'}
          </span>
          <span className="text-sm text-gray-600">디렉토리 공개 여부</span>
        </div>
        <div className="flex items-center gap-2">
          {listed && (
            <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="text-xs text-primary hover:underline">
              내 페이지 보기
            </Link>
          )}
          <button
            onClick={handleToggle}
            disabled={submitting}
            className={`px-4 py-1.5 text-xs font-medium border ${
              listed ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'bg-primary text-white border-primary hover:bg-primary-dark'
            }`}
          >
            {submitting ? '처리 중...' : listed ? '등록 해제' : '디렉토리에 등록'}
          </button>
        </div>
      </div>

      {/* Logo + Company Name */}
      <div className="flex items-start gap-4 pb-6 border-b border-gray-200">
        <div className="w-20 h-20 bg-gray-100 overflow-hidden shrink-0">
          {imagePreview ? (
            <img src={imagePreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-xl">{(formData.company_name || profile.contact_name || '?').charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
            placeholder="업체명 / 표시 이름"
            className="naver-title"
          />
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary hover:underline">
              로고 {imagePreview ? '변경' : '등록'}
            </button>
            {imagePreview && (
              <>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={handleRemoveImage} className="text-red-400 hover:underline">삭제</button>
              </>
            )}
            <span className="text-gray-400 ml-auto">JPG, PNG 최대 2MB</span>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
      </div>

      {/* Info Rows */}
      <div className="naver-form">
        <div className="naver-row">
          <div className="naver-label">업종</div>
          <div className="naver-content">
            <div className="flex flex-wrap gap-1.5">
              {BUSINESS_TYPES.map((t) => {
                const selected = formData.business_type.split(',').filter(Boolean).includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => togglePill('business_type', t.value)}
                    className={`naver-pill ${selected ? 'naver-pill-active' : 'naver-pill-inactive'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="naver-row">
          <div className="naver-label">지역<span className="text-red-500 ml-0.5">*</span></div>
          <div className="naver-content">
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map((r) => {
                const selected = formData.region.split(',').filter(Boolean).includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => togglePill('region', r.value)}
                    className={`naver-pill ${selected ? 'naver-pill-active' : 'naver-pill-inactive'}`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="naver-row">
          <div className="naver-label">업체 규모</div>
          <div className="naver-content">
            <div className="flex flex-wrap gap-1.5">
              {COMPANY_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, company_size: prev.company_size === s.value ? '' : s.value }))}
                  className={`naver-pill ${formData.company_size === s.value ? 'naver-pill-active' : 'naver-pill-inactive'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="naver-row">
          <div className="naver-label">설립연도</div>
          <div className="naver-content">
            <input
              type="text"
              value={formData.established_year}
              onChange={(e) => setFormData(prev => ({ ...prev, established_year: e.target.value }))}
              placeholder="예: 2020"
              maxLength={4}
              className="naver-input"
            />
          </div>
        </div>

        <div className="naver-row">
          <div className="naver-label">주소</div>
          <div className="naver-content">
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="상세 주소를 입력해주세요"
              className="naver-input"
            />
          </div>
        </div>

        <div className="naver-row">
          <div className="naver-label">연락처</div>
          <div className="naver-content">
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="010-0000-0000"
              className="naver-input"
            />
          </div>
        </div>

        <div className="naver-row">
          <div className="naver-label">웹사이트</div>
          <div className="naver-content">
            <input
              type="text"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://"
              className="naver-input"
            />
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="border-b border-gray-200 pb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">소개</label>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
          rows={4}
          className="naver-textarea"
          placeholder="업체 소개를 입력해주세요"
        />
      </div>

      {/* Gallery */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">갤러리</label>
        {galleryPreviews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
            {galleryPreviews.map((src, i) => (
              <div key={i} className="relative aspect-square border border-gray-200 overflow-hidden group">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveGalleryItem(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
          className="w-full border border-dashed border-gray-300 py-6 text-center hover:border-gray-500 transition-colors"
        >
          <p className="text-sm text-gray-500">+ 사진 추가</p>
          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG 최대 5MB (여러 장 선택 가능)</p>
        </button>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
        <Link href={ROUTES.MYPAGE} className="px-5 py-2.5 border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">취소</Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-2.5 bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
}
