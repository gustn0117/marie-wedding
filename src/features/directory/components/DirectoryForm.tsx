'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';
import { createClient } from '@/lib/supabase/client';
import RichTextEditor from '@/shared/components/RichTextEditor';
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
    profile.profile_image ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}` : null
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
    if (!formData.region) { setError('지역을 1개 이상 선택해주세요.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

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
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-700">저장되었습니다. 페이지 이동 중...</p>
        </div>
      )}

      {/* Status Card */}
      <div className={`flex items-center justify-between p-4 border-2 ${listed ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${listed ? 'bg-green-500' : 'bg-gray-300'}`}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              {listed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              )}
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{listed ? '디렉토리에 공개 중' : '디렉토리 미공개'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {listed ? '다른 사용자가 내 업체를 찾을 수 있어요' : '정보를 입력한 후 공개해보세요'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {listed && (
            <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="px-3 py-1.5 text-xs font-medium border border-gray-300 hover:bg-white">
              페이지 보기
            </Link>
          )}
          <button
            onClick={handleToggle}
            disabled={submitting}
            className={`px-4 py-1.5 text-xs font-bold ${
              listed ? 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50' : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {submitting ? '처리 중...' : listed ? '공개 해제' : '공개하기'}
          </button>
        </div>
      </div>

      {/* STEP 1: 프로필 이미지 & 업체명 */}
      <Section step={1} title="업체 기본 정보" description="로고와 업체명은 디렉토리에서 가장 먼저 보이는 정보입니다.">
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 border border-gray-300 bg-gray-50 overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-3xl">{(formData.company_name || profile.contact_name || '?').charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-1 text-[11px]">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary hover:underline">
                {imagePreview ? '변경' : '등록'}
              </button>
              {imagePreview && (
                <>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={handleRemoveImage} className="text-red-400 hover:underline">삭제</button>
                </>
              )}
            </div>
            <p className="text-[11px] text-gray-400">JPG, PNG · 2MB</p>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">업체명 / 표시 이름</label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="예) 그랜드 웨딩홀"
              className="w-full px-4 py-3 border border-gray-300 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                    className={`px-4 py-2 text-sm font-medium border transition-all ${
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
                className="w-full px-4 py-2.5 border border-gray-300 text-[15px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </FieldRow>
            <FieldRow label="연락처">
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="010-0000-0000"
                className="w-full px-4 py-2.5 border border-gray-300 text-[15px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </FieldRow>
          </div>

          <FieldRow label="주소">
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="예) 서울 강남구 테헤란로 123"
              className="w-full px-4 py-2.5 border border-gray-300 text-[15px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </FieldRow>

          <FieldRow label="웹사이트">
            <input
              type="text"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://"
              className="w-full px-4 py-2.5 border border-gray-300 text-[15px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
        {galleryPreviews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
            {galleryPreviews.map((src, i) => (
              <div key={i} className="relative aspect-square border border-gray-200 overflow-hidden group">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveGalleryItem(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
          className="w-full border-2 border-dashed border-gray-300 py-8 text-center hover:border-primary hover:bg-primary-50/30 transition-colors"
        >
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <p className="text-sm font-medium text-gray-700">사진 추가</p>
          <p className="text-xs text-gray-400 mt-0.5">여러 장 선택 가능 · JPG, PNG · 최대 5MB</p>
        </button>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
      </Section>

      {/* Save */}
      <div className="flex items-center justify-end gap-2 pt-6 border-t border-gray-300 sticky bottom-0 bg-white -mx-4 px-4 py-4">
        <Link href={ROUTES.MYPAGE} className="px-6 py-3 border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-10 py-3 bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
}

function Section({ step, title, description, children }: { step: number; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border-l-4 border-primary pl-5 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 bg-primary text-white text-xs font-bold flex items-center justify-center rounded-full">{step}</span>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4 ml-8">{description}</p>
      <div className="ml-8">{children}</div>
    </section>
  );
}

function FieldRow({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5">
        <label className="text-sm font-semibold text-gray-800">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
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
            className={`px-4 py-2 text-sm font-medium border transition-all ${
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
