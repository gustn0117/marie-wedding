'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';

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

  const [formData, setFormData] = useState({
    company_name: profile.company_name || '',
    business_type: profile.business_type || '',
    region: profile.region || '',
    bio: profile.bio || '',
    phone: profile.phone || '',
    website: profile.website || '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    profile.profile_image
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
      : null
  );

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

  const handleToggle = async () => {
    if (!listed && (!formData.company_name.trim() && !profile.contact_name)) {
      setError('이름 또는 업체명을 입력해주세요.');
      return;
    }
    if (!listed && !formData.region) {
      setError('지역을 1개 이상 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const next = !listed;
      await directoryService.toggleDirectoryListing(profile.id, next);
      setListed(next);
      document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했습니다.');
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.region) {
      setError('지역을 1개 이상 선택해주세요.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      let profileImage = profile.profile_image;
      if (imageFile) {
        const supabase = createClient();
        const ext = imageFile.name.split('.').pop();
        const path = `${profile.user_id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, imageFile, { upsert: true });
        if (uploadError) throw new Error('이미지 업로드에 실패했습니다.');
        profileImage = path;
      } else if (!imagePreview && profile.profile_image) {
        profileImage = null;
      }

      await directoryService.updateProfile(profile.id, {
        company_name: formData.company_name.trim() || null,
        business_type: formData.business_type || null,
        region: formData.region,
        bio: formData.bio.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        profile_image: profileImage,
      });

      document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      setSuccess(true);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">등록 상태</h2>
            <p className="text-sm text-gray-500 mt-0.5">디렉토리에 공개하면 다른 사용자가 찾을 수 있습니다.</p>
          </div>
          <button
            onClick={handleToggle}
            disabled={submitting}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
              listed
                ? 'border border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {submitting ? '처리 중...' : listed ? '등록 해제' : '디렉토리에 등록'}
          </button>
        </div>
        {listed && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link href={ROUTES.DIRECTORY_DETAIL(profile.id)} className="text-sm text-primary hover:underline">
              내 디렉토리 페이지 보기
            </Link>
          </div>
        )}
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">디렉토리 정보 수정</h2>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
        {success && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">저장되었습니다.</div>}

        {/* Profile Image */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              {imagePreview ? (
                <img src={imagePreview} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-xl">{(formData.company_name || profile.contact_name || '?').charAt(0)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-primary hover:underline text-left">
              사진 {imagePreview ? '변경' : '등록'}
            </button>
            {imagePreview && (
              <button type="button" onClick={handleRemoveImage} className="text-sm text-red-400 hover:underline text-left">삭제</button>
            )}
            <p className="text-[11px] text-gray-400">JPG, PNG 최대 2MB</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        </div>

        {/* Company Name */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-800">업체명 / 표시 이름</label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
            placeholder="디렉토리에 표시할 이름"
            className="input-field w-full"
          />
        </div>

        {/* Business Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">업종 <span className="text-xs text-gray-400 font-normal">(복수 선택 가능)</span></label>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map((t) => {
              const selected = formData.business_type.split(',').filter(Boolean).includes(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    const current = formData.business_type.split(',').filter(Boolean);
                    const next = selected ? current.filter(v => v !== t.value) : [...current, t.value];
                    setFormData(prev => ({ ...prev, business_type: next.join(',') }));
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selected ? 'bg-primary text-white shadow-sm' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Region */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">지역 <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">(복수 선택 가능)</span></label>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => {
              const regions = formData.region.split(',').filter(Boolean);
              const selected = regions.includes(r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    const next = selected ? regions.filter(v => v !== r.value) : [...regions, r.value];
                    setFormData(prev => ({ ...prev, region: next.join(',') }));
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selected ? 'bg-primary text-white shadow-sm' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-800">소개</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            rows={3}
            className="input-field w-full resize-y"
            placeholder="업체 소개를 입력해주세요"
          />
        </div>

        {/* Phone & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-800">연락처</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="input-field w-full"
              placeholder="010-0000-0000"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-800">웹사이트</label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              className="input-field w-full"
              placeholder="https://"
            />
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm px-6 py-2.5 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">안내</h3>
        <ul className="space-y-1.5 text-[13px] text-gray-500">
          <li>- 등록하면 업체 디렉토리에 정보가 공개됩니다.</li>
          <li>- 프로필 사진, 소개글을 작성하면 더 많은 관심을 받을 수 있습니다.</li>
          <li>- 언제든지 등록을 해제할 수 있습니다.</li>
        </ul>
      </div>
    </>
  );
}
