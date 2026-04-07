'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';
import { createClient } from '@/lib/supabase/client';

export default function EditProfilePage() {
  const { profile, isLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    contact_name: '',
    company_name: '',
    business_type: '',
    region: '',
    bio: '',
    phone: '',
    website: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (profile && !initialized) {
    setFormData({
      contact_name: profile.contact_name || '',
      company_name: profile.company_name || '',
      business_type: profile.business_type || '',
      region: profile.region || '',
      bio: profile.bio || '',
      phone: profile.phone || '',
      website: profile.website || '',
    });
    if (profile.profile_image) {
      setImagePreview(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`);
    }
    setInitialized(true);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('이미지 크기는 2MB 이하여야 합니다.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !profile) return profile?.profile_image || null;

    const supabase = createClient();
    const ext = imageFile.name.split('.').pop();
    const path = `${profile.user_id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, imageFile, { upsert: true });

    if (uploadError) throw new Error('이미지 업로드에 실패했습니다.');
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!formData.contact_name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!formData.region || formData.region.split(',').filter(Boolean).length === 0) {
      setError('지역을 1개 이상 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let profileImage = profile.profile_image;

      if (imageFile) {
        profileImage = await uploadImage();
      } else if (!imagePreview && profile.profile_image) {
        profileImage = null;
      }

      await directoryService.updateProfile(profile.id, {
        contact_name: formData.contact_name.trim(),
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
      setTimeout(() => { window.location.href = ROUTES.MYPAGE; }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-4">
          <div className="h-20 w-20 rounded-full bg-gray-200 mx-auto" />
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">로그인이 필요합니다</h2>
        <Link href={ROUTES.LOGIN} className="btn-primary text-sm">로그인하기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.MYPAGE} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">프로필 수정</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 space-y-6">
        {error && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">프로필이 수정되었습니다.</div>}

        {/* Profile Image */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100">
              {imagePreview ? (
                <img src={imagePreview} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-3xl">
                    {(formData.company_name || formData.contact_name || '?').charAt(0)}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          <div className="flex gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-primary hover:underline">
              사진 변경
            </button>
            {imagePreview && (
              <>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={handleRemoveImage} className="text-sm text-red-400 hover:underline">
                  삭제
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400">JPG, PNG 최대 2MB</p>
        </div>

        <hr className="border-gray-100" />

        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="contact_name" className="block text-sm font-medium text-gray-800">
            이름 <span className="text-red-500">*</span>
          </label>
          <input id="contact_name" name="contact_name" type="text" value={formData.contact_name} onChange={handleChange} className="input-field w-full" />
        </div>

        {/* Business fields */}
        {profile.account_type === 'business' && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="company_name" className="block text-sm font-medium text-gray-800">업체명</label>
              <input id="company_name" name="company_name" type="text" value={formData.company_name} onChange={handleChange} className="input-field w-full" />
            </div>
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
                        setError(null);
                        setSuccess(false);
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        selected
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-primary/40 hover:text-primary'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Region - 복수 선택 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">
            지역 <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">(복수 선택 가능)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => {
              const regions = formData.region.split(',').filter(Boolean);
              const selected = regions.includes(r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? regions.filter(v => v !== r.value)
                      : [...regions, r.value];
                    setFormData(prev => ({ ...prev, region: next.join(',') }));
                    setError(null);
                    setSuccess(false);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selected
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-primary/40 hover:text-primary'
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
          <label htmlFor="bio" className="block text-sm font-medium text-gray-800">소개</label>
          <textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} rows={4} className="input-field w-full resize-y" placeholder="간단한 소개를 입력해주세요" />
        </div>

        {/* Phone & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-800">연락처</label>
            <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} className="input-field w-full" placeholder="010-0000-0000" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="website" className="block text-sm font-medium text-gray-800">웹사이트</label>
            <input id="website" name="website" type="text" value={formData.website} onChange={handleChange} className="input-field w-full" placeholder="https://" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={ROUTES.MYPAGE} className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">취소</Link>
          <button type="submit" disabled={submitting} className="btn-primary text-sm px-5 py-2.5">
            {submitting ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
