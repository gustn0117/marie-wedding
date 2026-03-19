'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';

export default function EditProfilePage() {
  const router = useRouter();
  const { profile, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    contact_name: '',
    company_name: '',
    business_type: '',
    region: '',
    bio: '',
    phone: '',
    website: '',
  });
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize form data from profile
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
    setInitialized(true);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!formData.contact_name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!formData.region) {
      setError('지역을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await directoryService.updateProfile(profile.id, {
        contact_name: formData.contact_name.trim(),
        company_name: formData.company_name.trim() || null,
        business_type: formData.business_type || null,
        region: formData.region,
        bio: formData.bio.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
      });
      setSuccess(true);
      setTimeout(() => router.push(ROUTES.MYPAGE), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-secondary rounded" />
        <div className="card p-8 space-y-4">
          <div className="h-10 rounded bg-secondary" />
          <div className="h-10 rounded bg-secondary" />
          <div className="h-10 rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-text-primary mb-3">로그인이 필요합니다</h2>
        <Link href={ROUTES.LOGIN} className="btn-primary text-sm">로그인하기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.MYPAGE}
          className="p-2 rounded-lg hover:bg-secondary transition-colors duration-200"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">프로필 수정</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-6">
        {error && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">프로필이 수정되었습니다.</div>}

        <div className="space-y-1.5">
          <label htmlFor="contact_name" className="block text-sm font-medium text-text-primary">
            이름 <span className="text-red-500">*</span>
          </label>
          <input id="contact_name" name="contact_name" type="text" value={formData.contact_name} onChange={handleChange} className="input-field w-full" />
        </div>

        {profile.account_type === 'business' && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="company_name" className="block text-sm font-medium text-text-primary">업체명</label>
              <input id="company_name" name="company_name" type="text" value={formData.company_name} onChange={handleChange} className="input-field w-full" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="business_type" className="block text-sm font-medium text-text-primary">업종</label>
              <select id="business_type" name="business_type" value={formData.business_type} onChange={handleChange} className="input-field w-full">
                <option value="">선택해주세요</option>
                {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label htmlFor="region" className="block text-sm font-medium text-text-primary">
            지역 <span className="text-red-500">*</span>
          </label>
          <select id="region" name="region" value={formData.region} onChange={handleChange} className="input-field w-full">
            <option value="">선택해주세요</option>
            {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bio" className="block text-sm font-medium text-text-primary">소개</label>
          <textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} rows={4} className="input-field w-full resize-y" placeholder="간단한 소개를 입력해주세요" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="phone" className="block text-sm font-medium text-text-primary">연락처</label>
            <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} className="input-field w-full" placeholder="010-0000-0000" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="website" className="block text-sm font-medium text-text-primary">웹사이트</label>
            <input id="website" name="website" type="text" value={formData.website} onChange={handleChange} className="input-field w-full" placeholder="https://" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={ROUTES.MYPAGE} className="btn-outline text-sm">취소</Link>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">
            {submitting ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
