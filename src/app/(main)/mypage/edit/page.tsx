'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { useImageUpload } from '@/shared/hooks/useImageUpload';
import { usePendingUploads } from '@/shared/hooks/usePendingUploads';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import { directoryService } from '@/features/directory/services/directory-service';
import ImageUploadHint from '@/shared/components/ImageUploadHint';
import RichTextEditor from '@/shared/components/RichTextEditor';
import AccountWithdrawalSection from '@/features/mypage/components/AccountWithdrawalSection';
import { validatePhone } from '@/shared/utils/validation';
import { toast } from '@/shared/components/Toast';
import { withTimeout } from '@/shared/utils/withTimeout';
import { clearMarieProfileCookie } from '@/shared/utils/cookieHelpers';
import { apiFetch } from '@/shared/utils/apiFetch';

type ProfileFormField = 'contact_name' | 'company_name' | 'business_type' | 'region' | 'bio' | 'phone' | 'website';

export default function EditProfilePage() {
  const { profile, isLoading } = useAuth();
  const router = useRouter();

  // 업체 계정은 프로필 편집을 '공개 프로필'(디렉토리)로 통합했다.
  // 이 페이지로 들어오면 그쪽으로 보낸다. (개인 회원은 이 페이지를 그대로 사용)
  useEffect(() => {
    if (profile?.account_type === 'business') {
      router.replace(ROUTES.DIRECTORY_REGISTER);
    }
  }, [profile?.account_type, router]);

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
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [fullProfileStatus, setFullProfileStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const imageDirtyRef = useRef(false);
  const bioRef = useRef(formData.bio);
  const { trackUpload, waitForUploads, pendingCount } = usePendingUploads();
  const imageUpload = useImageUpload({
    initialPath: null,
    initialUrl: null,
    bucket: 'avatars',
    maxDimension: 800,
    maxSizeMB: 0.55,
    quality: 0.84,
    buildPath: (compressed) => `${profile?.user_id}/avatar_${Date.now()}_${crypto.randomUUID()}.${compressed.name.split('.').pop() || 'webp'}`,
  });

  useEffect(() => {
    bioRef.current = formData.bio;
  }, [formData.bio]);

  // 사용자가 수정한 필드는 늦게 도착한 백그라운드 DB 조회가 덮어쓰지 않는다.
  const dirtyFieldsRef = useRef(new Set<ProfileFormField>());
  // 초기화 1회 실행 가드 (ref) — initialized state 를 effect 의존성에 넣으면
  // setInitialized(true) 가 effect 를 재실행/cleanup 시켜 진행 중 DB 조회가 cancelled 로
  // 폐기됨(→ business_type/region/bio 미로딩). ref 로 가드해 재실행을 막는다.
  const didInitRef = useRef(false);
  // 백그라운드 전체 프로필 조회가 성공했는지 여부.
  // 미로드(조회 실패/timeout) 상태에서는 사용자가 직접 바꾼 필드만 보내 기존 DB 값을
  // 빈 값으로 덮어쓰지 않는다. 성공 시에는 전체 폼을 정상적으로 저장한다.
  const fullLoadedRef = useRef(false);

  // 렌더 전략: 쿠키 profile(즉시 사용 가능)로 폼·사진을 곧바로 노출하고,
  // bio/phone/website 등 쿠키에 없는 필드는 백그라운드 DB 조회로 채워 넣는다.
  // (기존: DB 조회가 끝나야만 initialized → 조회가 느리면 5초 스켈레톤,
  //  실패 fallback 시 profile_image 미반영 → '사진 연동 안됨' 증상)
  const profileId = profile?.id;
  useEffect(() => {
    if (!profileId || didInitRef.current) return;
    didInitRef.current = true;

    // 1) 쿠키 값으로 즉시 폼 오픈 (사진 포함) — 있는 필드만 우선 채움
    setFormData((prev) => ({
      contact_name: prev.contact_name || profile?.contact_name || '',
      company_name: prev.company_name || profile?.company_name || '',
      business_type: prev.business_type || profile?.business_type || '',
      region: prev.region || profile?.region || '',
      bio: prev.bio,
      phone: prev.phone,
      website: prev.website,
    }));
    if (profile?.profile_image) {
      imageUpload.setExisting(
        profile.profile_image,
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`,
      );
    }
    setInitialized(true);

    // 2) 전체 profile 을 DB 에서 조회해 확실히 채움.
    //    cancelled 플래그를 쓰지 않는다 — effect 재실행/StrictMode 로 조회 결과가
    //    폐기되어 업종/지역/소개/연락처가 초기화되던 문제를 원천 차단.
    (async () => {
      try {
        // 서버 라우트(service_role)로 확실히 조회 — 클라 세션 토큰 지연/RLS 로
        // 업종·소개 등이 안 채워져 '초기화'처럼 보이던 문제 방지.
        const res = await apiFetch('/api/profile/me', { credentials: 'include' }, 8000);
        const data = res.ok ? (await res.json()).profile : null;
        if (!data) {
          setFullProfileStatus('failed');
          return;
        }
        fullLoadedRef.current = true;
        setFullProfileStatus('loaded');
        // 필드별 dirty 상태를 보존한다. 사용자가 의도적으로 빈 값으로 만든 필드도
        // 늦게 도착한 조회 결과가 다시 채우지 않게 한다.
        setFormData((prev) => {
          const dirty = dirtyFieldsRef.current;
          const next = {
            contact_name: dirty.has('contact_name') ? prev.contact_name : data.contact_name || '',
            company_name: dirty.has('company_name') ? prev.company_name : data.company_name || '',
            business_type: dirty.has('business_type') ? prev.business_type : data.business_type || '',
            region: dirty.has('region') ? prev.region : data.region || '',
            bio: dirty.has('bio') ? prev.bio : data.bio || '',
            phone: dirty.has('phone') ? prev.phone : data.phone || '',
            website: dirty.has('website') ? prev.website : data.website || '',
          };
          bioRef.current = next.bio;
          return next;
        });
        // 사진은 새로 바꾸지 않았을 때만 DB 값으로 동기화
        if (!imageDirtyRef.current) {
          imageUpload.setExisting(
            data.profile_image ?? null,
            data.profile_image
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${data.profile_image}`
              : null,
          );
        }
      } catch (err) {
        setFullProfileStatus('failed');
        console.warn('[mypage/edit] profile fetch failed:', err);
      }
    })();
  // profileId 만 의존. 1회 실행은 didInitRef 로 보장.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    dirtyFieldsRef.current.add(name as ProfileFormField);
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  // 파일 고르는 즉시 백그라운드 업로드 → 저장은 텍스트만이라 즉시 완료.
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submittingRef.current) {
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return; }
    if (!profile?.user_id) { setError('프로필 정보를 불러오는 중이에요. 잠시 후 다시 시도해주세요.'); return; }
    imageDirtyRef.current = true;
    setError(null);
    imageUpload.selectFile(file);
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    if (submittingRef.current) return;
    imageDirtyRef.current = true;
    imageUpload.remove();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || submittingRef.current) return;

    const fail = (msg: string, focusId?: string) => {
      setError(msg);
      toast(msg, 'error');
      if (focusId) {
        const el = document.getElementById(focusId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (el as HTMLInputElement | HTMLTextAreaElement).focus?.({ preventScroll: true });
        }
      }
    };

    if (fullProfileStatus === 'loading') {
      fail('프로필 전체 정보를 확인 중입니다. 잠시 후 다시 저장해주세요.');
      return;
    }

    const shouldWrite = (field: ProfileFormField) => fullLoadedRef.current || dirtyFieldsRef.current.has(field);

    if (shouldWrite('contact_name') && !formData.contact_name.trim()) {
      fail('이름을 입력해주세요.', 'contact_name');
      return;
    }
    // 개인회원 프로필에서 지역은 선택 항목이다(업체는 이 화면에 오지 않음). 사용자가 직접
    // 지역을 편집(dirty)한 경우에만 비었는지 검사한다. 이게 없으면 지역 미설정 개인회원이
    // 이름/소개만 바꿔도 '지역을 선택하세요'로 저장이 막혔다.
    if (dirtyFieldsRef.current.has('region') && (!formData.region || formData.region.split(',').filter(Boolean).length === 0)) {
      fail('지역을 1개 이상 선택해주세요.');
      return;
    }
    if (shouldWrite('phone')) {
      const phoneCheck = validatePhone(formData.phone);
      if (!phoneCheck.valid) {
        fail(phoneCheck.reason ?? '연락처를 정확히 입력해주세요.', 'phone');
        return;
      }
    }
    // 소개(bio)는 선택 항목 — 필수 검사 없음.

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const [profileImage] = await Promise.all([
        imageUpload.waitForUpload(),
        waitForUploads(),
      ]);

      // 전체 조회 실패 상태에서는 직접 수정하지 않은 키를 undefined로 두고,
      // JSON.stringify/API 화이트리스트가 해당 필드를 건너뛰게 한다.
      const nullable = (field: ProfileFormField, value: string) =>
        shouldWrite(field) ? (value.trim() || null) : undefined;

      await withTimeout(
        directoryService.updateProfile(profile.id, {
          contact_name: shouldWrite('contact_name') ? formData.contact_name.trim() : undefined,
          company_name: nullable('company_name', formData.company_name),
          business_type: nullable('business_type', formData.business_type),
          region: shouldWrite('region') ? formData.region : undefined,
          bio: nullable('bio', bioRef.current),
          phone: nullable('phone', formData.phone),
          website: nullable('website', formData.website),
          profile_image: fullLoadedRef.current || imageDirtyRef.current ? profileImage : undefined,
        }),
        15000,
        '저장이 너무 오래 걸려요. 다시 시도해주세요.',
      );
      // ?next= 지원 — 동일 origin path만 허용
      const sp = new URLSearchParams(window.location.search);
      const rawNext = sp.get('next');
      const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('://') ? rawNext : ROUTES.MYPAGE;

      // cookie clear는 redirect 직전에 (이전 setTimeout 패턴에서 race 가능성을 없앰)
      clearMarieProfileCookie();
      setSuccess(true);
      router.push(next);
      router.refresh();
      submittingRef.current = false;
      setSubmitting(false);
    } catch (err) {
      submittingRef.current = false;
      console.error('[mypage/edit] save failed:', err);
      const msg = err instanceof Error ? err.message : '프로필 수정에 실패했습니다.';
      setError(msg);
      toast(msg, 'error');
      setSubmitting(false);
    }
  };

  // profile 이 없을 때만: 세션 확인 중이면 스켈레톤, 확인 끝났으면 로그인 안내.
  // 쿠키 profile 이 있으면(=대개 즉시) 아래 폼으로 바로 진입 → 진입 지연 제거.
  if (!profile) {
    return isLoading ? (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="bg-white rounded border border-gray-200 p-8 space-y-4">
          <div className="h-20 w-20 rounded bg-gray-200 mx-auto" />
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
        </div>
      </div>
    ) : (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-bold text-gray-900 mb-3">로그인이 필요합니다</h2>
        <Link href={ROUTES.LOGIN} className="btn-primary text-sm">로그인하기</Link>
      </div>
    );
  }

  // 업체 계정은 '공개 프로필'로 리다이렉트 중 — 폼 플래시 방지용 스켈레톤
  if (profile.account_type === 'business') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="bg-white rounded border border-gray-200 p-8 space-y-4">
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  // DB 프로필 fetch 완료 전엔 빈 폼 노출 X — 에러가 있으면 에러 박스, 아니면 skeleton
  if (!initialized) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 h-8 rounded border border-rose-300 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                새로고침
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-pulse">
            <div className="h-8 w-40 bg-gray-200 rounded" />
            <div className="bg-white rounded border border-gray-200 p-8 space-y-4">
              <div className="h-20 w-20 rounded bg-gray-200 mx-auto" />
              <div className="h-10 rounded bg-gray-200" />
              <div className="h-10 rounded bg-gray-200" />
              <div className="h-10 rounded bg-gray-200" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[760px] mx-auto space-y-4">
      <div className="saramin-section p-5 flex items-center gap-3">
        <Link href={ROUTES.MYPAGE} className="p-2 rounded hover:bg-primary-50 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <p className="text-sm font-bold text-primary">My Page</p>
          <h1 className="text-2xl font-bold text-gray-900">프로필 수정</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded border border-gray-200 p-6 md:p-8 space-y-6">
        <fieldset disabled={submitting} className="contents">
        {error && <div className="p-4 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">{error}</div>}
        {success && <div className="p-4 rounded bg-state-new-bg border border-green-200 text-state-new text-sm">프로필이 수정되었습니다.</div>}
        {fullProfileStatus === 'failed' && (
          <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            일부 기존 정보를 불러오지 못했습니다. 지금 직접 변경한 항목만 안전하게 저장됩니다.
          </div>
        )}

        {/* Profile Image */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded overflow-hidden border-2 border-gray-200 bg-gray-100">
              {imageUpload.preview ? (
                <img src={imageUpload.preview} alt="프로필" className="w-full h-full object-cover" />
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
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors"
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
            {imageUpload.preview && (
              <>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={handleRemoveImage} className="text-sm text-state-urgent hover:underline">
                  삭제
                </button>
              </>
            )}
          </div>
          <ImageUploadHint ratio="1:1 (정사각형)" recommendedSize="400 × 400px" maxSize="자동 압축" />
          {imageUpload.uploading && (
            <div className="w-full max-w-xs" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${imageUpload.progress?.percent ?? 1}%` }} />
              </div>
              <p className="mt-1 text-center text-xs font-medium text-primary">{imageUpload.statusText}</p>
            </div>
          )}
          {imageUpload.error && <p className="text-xs text-state-urgent">{imageUpload.error}</p>}
        </div>

        <hr className="border-gray-100" />

        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="contact_name" className="block text-sm font-medium text-gray-800">
            이름 <span className="text-state-urgent">*</span>
          </label>
          <input id="contact_name" name="contact_name" type="text" value={formData.contact_name} onChange={handleChange} className="input-field w-full" />
        </div>

        {/* 업종 - 모든 회원 */}
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
                    dirtyFieldsRef.current.add('business_type');
                    const current = formData.business_type.split(',').filter(Boolean);
                    const next = selected ? current.filter(v => v !== t.value) : [...current, t.value];
                    setFormData(prev => ({ ...prev, business_type: next.join(',') }));
                    setError(null);
                    setSuccess(false);
                  }}
                  className={`px-4 py-2 rounded text-sm font-bold transition-all ${
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

        {/* Region - 복수 선택 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">
            지역 <span className="text-state-urgent">*</span> <span className="text-xs text-gray-400 font-normal">(복수 선택 가능)</span>
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
                    dirtyFieldsRef.current.add('region');
                    const next = selected
                      ? regions.filter(v => v !== r.value)
                      : [...regions, r.value];
                    setFormData(prev => ({ ...prev, region: next.join(',') }));
                    setError(null);
                    setSuccess(false);
                  }}
                  className={`px-4 py-2 rounded text-sm font-bold transition-all ${
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
          <label htmlFor="bio" className="block text-sm font-medium text-gray-800">
            소개 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <RichTextEditor
            value={formData.bio}
            onChange={(html) => {
              dirtyFieldsRef.current.add('bio');
              bioRef.current = html;
              setFormData((prev) => ({ ...prev, bio: html }));
              setError(null);
              setSuccess(false);
            }}
            placeholder="회사/본인 소개를 자유롭게 작성하세요. 사진도 넣을 수 있어요."
            minHeight={160}
            onUploadPromise={trackUpload}
            disabled={submitting}
          />
        </div>

        {/* Phone & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-800">
              연락처 <span className="text-state-urgent">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="input-field w-full"
              placeholder="010-0000-0000"
              required={fullProfileStatus === 'loaded'}
              aria-required={fullProfileStatus === 'loaded'}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="website" className="block text-sm font-medium text-gray-800">웹사이트</label>
            <input id="website" name="website" type="text" value={formData.website} onChange={handleChange} className="input-field w-full" placeholder="https://" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={ROUTES.MYPAGE} className="rounded border border-gray-300 px-5 py-2.5 text-sm font-bold hover:border-primary hover:text-primary transition-colors">취소</Link>
          <button type="submit" disabled={submitting || fullProfileStatus === 'loading'} className="btn-primary text-sm px-5 py-2.5">
            {fullProfileStatus === 'loading'
              ? '정보 확인 중…'
              : submitting
                ? (imageUpload.uploading
                  ? imageUpload.statusText
                  : pendingCount > 0
                    ? `본문 사진 ${pendingCount}건 마무리 중...`
                    : '저장 중...')
                : '저장하기'}
          </button>
        </div>
        </fieldset>
      </form>

      <AccountWithdrawalSection />
    </div>
  );
}
