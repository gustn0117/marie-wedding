'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authService } from '@/features/auth/services/auth-service';
import { withTimeout } from '@/shared/utils/withTimeout';
import { validateEmail } from '@/shared/utils/validation';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import Logo from '@/shared/components/Logo';
import SocialLoginButtons from '@/features/auth/components/SocialLoginButtons';
import type { SignupFormData } from '@/features/auth/types';

const STEPS = {
  SELECT_TYPE: 0,
  ACCOUNT: 1,
  PROFILE: 2,
};

// 회원가입 STEP 0에서 선택한 계정 유형을 OAuth callback에 전달하기 위해 cookie로 저장.
// /auth/callback과 /auth/naver/callback에서 읽어 profile.account_type에 preset 후 cookie 삭제.
function persistSignupType(type: 'individual' | 'business') {
  if (typeof document === 'undefined') return;
  document.cookie = `signup_account_type=${type}; path=/; max-age=600; samesite=lax`;
}

export default function SignupForm() {
  const [formData, setFormData] = useState<SignupFormData>({
    accountType: '',
    email: '',
    password: '',
    confirmPassword: '',
    contactName: '',
    regions: [],
    businessTypes: [],
    companyName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(STEPS.SELECT_TYPE);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validateAccount = (): boolean => {
    const emailCheck = validateEmail(formData.email);
    if (!emailCheck.valid) { setError(emailCheck.reason ?? '이메일이 올바르지 않습니다.'); return false; }
    if (!formData.password) { setError('비밀번호를 입력해주세요.'); return false; }
    if (formData.password.length < 6) { setError('비밀번호는 최소 6자 이상이어야 합니다.'); return false; }
    if (formData.password !== formData.confirmPassword) { setError('비밀번호가 일치하지 않습니다.'); return false; }
    return true;
  };

  const validateProfile = (): boolean => {
    if (!formData.contactName.trim()) { setError('이름을 입력해주세요.'); return false; }
    if (formData.regions.length === 0) { setError('지역을 선택해주세요.'); return false; }
    if (formData.accountType === 'business') {
      if (formData.businessTypes.length === 0) { setError('업종을 1개 이상 선택해주세요.'); return false; }
      if (!formData.companyName?.trim()) { setError('업체명을 입력해주세요.'); return false; }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.accountType) { setError('회원 유형을 선택해주세요.'); setStep(STEPS.SELECT_TYPE); return; }
    if (!validateProfile()) return;

    setLoading(true);
    try {
      await withTimeout(authService.signUp(formData.email, formData.password, {
        accountType: formData.accountType,
        contactName: formData.contactName.trim(),
        regions: formData.regions,
        businessTypes: formData.businessTypes.length > 0 ? formData.businessTypes : undefined,
        companyName: formData.companyName?.trim() || undefined,
      }), 15000);
      // router.push는 client navigation이라 미들웨어를 통과하지 않아 marie_profile cookie가 set되지 않음.
      // 가입 직후엔 full reload로 헤더(profile/이름/로그아웃 메뉴)가 즉시 반영되도록 한다.
      window.location.href = ROUTES.HOME;
      return;
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message.includes('already registered') ? '이미 가입된 이메일입니다.' : err.message);
      } else {
        setError('회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 3;
  const stepLabels = ['회원 유형', '계정 정보', formData.accountType === 'business' ? '업체 정보' : '개인 정보'];

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-surface rounded border border-border p-8 shadow-sm">
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-6 gap-2">
          <Link href={ROUTES.HOME} aria-label="Marié 홈">
            <Logo variant="full" size="lg" />
          </Link>
          <p className="text-sm text-text-secondary">웨딩업계 구인구직 플랫폼 회원가입</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                step >= i ? 'bg-primary text-white' : 'bg-gray-200 text-text-muted'
              }`}>
                {i + 1}
              </div>
              <span className="text-xs text-text-secondary hidden sm:inline">{stepLabels[i]}</span>
              {i < totalSteps - 1 && <div className={`w-6 h-0.5 transition-colors ${step > i ? 'bg-primary' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 rounded bg-state-urgent-bg border border-red-200 text-state-urgent text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 0: 회원 유형 선택 */}
          {step === STEPS.SELECT_TYPE && (
            <>
              <p className="text-center text-sm text-gray-700 mb-2 font-semibold">먼저, 어떤 회원으로 가입하시나요?</p>
              <p className="text-center text-xs text-gray-500 mb-5">선택한 유형은 소셜 가입에도 적용됩니다.</p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setFormData(prev => ({ ...prev, accountType: 'individual' })); persistSignupType('individual'); }}
                  className={`w-full p-5 rounded border-2 text-left transition-all hover:border-primary ${formData.accountType === 'individual' ? 'border-primary bg-primary-50' : 'border-gray-200'}`}
                  aria-pressed={formData.accountType === 'individual'}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 rounded flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">개인 회원</h3>
                      <p className="text-sm text-gray-500 mt-0.5">채용 공고에 지원하고 커뮤니티에 참여합니다</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setFormData(prev => ({ ...prev, accountType: 'business' })); persistSignupType('business'); }}
                  className={`w-full p-5 rounded border-2 text-left transition-all hover:border-primary ${formData.accountType === 'business' ? 'border-primary bg-primary-50' : 'border-gray-200'}`}
                  aria-pressed={formData.accountType === 'business'}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 rounded flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">업체 회원</h3>
                      <p className="text-sm text-gray-500 mt-0.5">채용 공고를 작성하고 지원자를 관리합니다</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* 유형 선택 후에만 진행 UI 노출 — '먼저 유형을 골라야 한다'는 흐름을 시각적으로 강제 */}
              {formData.accountType && (
                <div className="mt-5 pt-5 border-t border-gray-200 space-y-3">
                  <p className="text-center text-[12px] text-gray-500">
                    선택: <span className="font-bold text-ink">{formData.accountType === 'business' ? '업체 회원' : '개인 회원'}</span> —
                    소셜로 가입해도 위 유형이 그대로 적용됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(STEPS.ACCOUNT)}
                    className="btn-primary w-full"
                  >
                    이메일로 가입 진행
                  </button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-surface px-3 text-text-muted">또는 소셜로 가입</span></div>
                  </div>
                  <SocialLoginButtons mode="signup" onError={setError} />
                </div>
              )}

              {!formData.accountType && (
                <p className="mt-4 text-center text-[11.5px] text-gray-400">
                  먼저 위에서 회원 유형을 선택해주세요.
                </p>
              )}
            </>
          )}

          {/* Step 1: 계정 정보 */}
          {step === STEPS.ACCOUNT && (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">이메일</label>
                <input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleChange} placeholder="example@company.com" className="input-field" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">비밀번호</label>
                <input id="password" name="password" type="password" autoComplete="new-password" required value={formData.password} onChange={handleChange} placeholder="6자 이상 입력하세요" className="input-field" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-1.5">비밀번호 확인</label>
                <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required value={formData.confirmPassword} onChange={handleChange} placeholder="비밀번호를 다시 입력하세요" className="input-field" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(STEPS.SELECT_TYPE)} className="btn-outline flex-1">이전</button>
                <button type="button" onClick={() => { setError(null); if (validateAccount()) setStep(STEPS.PROFILE); }} className="btn-primary flex-1">다음</button>
              </div>
            </>
          )}

          {/* Step 2: 프로필 정보 */}
          {step === STEPS.PROFILE && (
            <>
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-text-primary mb-1.5">
                  {formData.accountType === 'business' ? '담당자명' : '이름'}
                </label>
                <input id="contactName" name="contactName" type="text" required value={formData.contactName} onChange={handleChange} placeholder={formData.accountType === 'business' ? '담당자명을 입력하세요' : '이름을 입력하세요'} className="input-field" />
              </div>

              {formData.accountType === 'business' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-3">업종 (복수 선택 가능)</label>
                    {formData.businessTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {formData.businessTypes.map((bt) => (
                          <span key={bt} className="inline-flex items-center gap-1.5 rounded bg-primary pl-3 pr-2 py-1.5 text-xs font-bold text-white">
                            {BUSINESS_TYPES.find(t => t.value === bt)?.label}
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, businessTypes: prev.businessTypes.filter(v => v !== bt) }))}
                              className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {BUSINESS_TYPES.map((type) => {
                        const selected = formData.businessTypes.includes(type.value);
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                businessTypes: selected
                                  ? prev.businessTypes.filter(v => v !== type.value)
                                  : [...prev.businessTypes, type.value],
                              }));
                            }}
                            className={`py-2.5 rounded text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                              selected
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/40 hover:text-primary hover:shadow-sm'
                            }`}
                          >
                            {selected && (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-text-primary mb-1.5">업체명</label>
                    <input id="companyName" name="companyName" type="text" required value={formData.companyName} onChange={handleChange} placeholder="업체명을 입력하세요" className="input-field" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-text-primary mb-3">활동 지역</label>

                {/* 선택된 지역 태그 표시 */}
                {formData.regions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {formData.regions.map((r) => (
                      <span key={r} className="inline-flex items-center gap-1.5 rounded bg-primary pl-3 pr-2 py-1.5 text-xs font-bold text-white">
                        {r === 'all' ? '전국' : REGIONS.find(reg => reg.value === r)?.label}
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, regions: prev.regions.filter(v => v !== r) }))}
                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, regions: [] }))}
                      className="text-xs text-gray-400 hover:text-gray-600 self-center ml-1"
                    >
                      전체 해제
                    </button>
                  </div>
                )}

                {/* 전국 */}
                <button
                  type="button"
                  onClick={() => {
                    if (formData.regions.includes('all')) {
                      setFormData(prev => ({ ...prev, regions: [] }));
                    } else {
                      setFormData(prev => ({ ...prev, regions: ['all'] }));
                    }
                  }}
                  className={`w-full py-3 rounded text-sm font-bold transition-all mb-3 flex items-center justify-center gap-2 ${
                    formData.regions.includes('all')
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-primary hover:text-primary'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  전국
                </button>

                {/* 지역 그리드 */}
                {!formData.regions.includes('all') && (
                  <div className="grid grid-cols-3 gap-2">
                    {REGIONS.map((region) => {
                      const selected = formData.regions.includes(region.value);
                      return (
                        <button
                          key={region.value}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              regions: selected
                                ? prev.regions.filter(r => r !== region.value)
                                : [...prev.regions, region.value],
                            }));
                          }}
                          className={`py-2.5 rounded text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                            selected
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/40 hover:text-primary hover:shadow-sm'
                          }`}
                        >
                          {selected && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                          {region.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {formData.regions.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">지역을 1개 이상 선택해주세요</p>
                )}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(STEPS.ACCOUNT)} className="btn-outline flex-1">이전</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      가입 중...
                    </>
                  ) : '가입하기'}
                </button>
              </div>
            </>
          )}
        </form>


        {/* Login Link */}
        <p className="text-center text-sm text-text-secondary">
          이미 계정이 있으신가요?{' '}
          <Link href={ROUTES.LOGIN} className="font-medium text-primary hover:text-primary-dark transition-colors">로그인</Link>
        </p>
      </div>
    </div>
  );
}
