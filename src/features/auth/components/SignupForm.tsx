'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/features/auth/services/auth-service';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import type { SignupFormData } from '@/features/auth/types';

const STEPS = {
  SELECT_TYPE: 0,
  ACCOUNT: 1,
  PROFILE: 2,
};

export default function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<SignupFormData>({
    accountType: 'individual',
    email: '',
    password: '',
    confirmPassword: '',
    contactName: '',
    region: '',
    businessType: '',
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
    if (!formData.email) { setError('이메일을 입력해주세요.'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('올바른 이메일 형식을 입력해주세요.'); return false; }
    if (!formData.password) { setError('비밀번호를 입력해주세요.'); return false; }
    if (formData.password.length < 6) { setError('비밀번호는 최소 6자 이상이어야 합니다.'); return false; }
    if (formData.password !== formData.confirmPassword) { setError('비밀번호가 일치하지 않습니다.'); return false; }
    return true;
  };

  const validateProfile = (): boolean => {
    if (!formData.contactName.trim()) { setError('이름을 입력해주세요.'); return false; }
    if (!formData.region) { setError('지역을 선택해주세요.'); return false; }
    if (formData.accountType === 'business') {
      if (!formData.businessType) { setError('업종을 선택해주세요.'); return false; }
      if (!formData.companyName?.trim()) { setError('업체명을 입력해주세요.'); return false; }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateProfile()) return;

    setLoading(true);
    try {
      await authService.signUp(formData.email, formData.password, {
        accountType: formData.accountType,
        contactName: formData.contactName.trim(),
        region: formData.region,
        businessType: formData.businessType || undefined,
        companyName: formData.companyName?.trim() || undefined,
      });
      router.push(ROUTES.HOME);
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
      <div className="bg-surface rounded-2xl border border-border p-8 shadow-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="font-serif text-3xl font-bold text-primary tracking-wide">Marié</h1>
          <p className="mt-2 text-sm text-text-secondary">웨딩업계 B2B 플랫폼 회원가입</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
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
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 0: 회원 유형 선택 */}
          {step === STEPS.SELECT_TYPE && (
            <>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setFormData(prev => ({ ...prev, accountType: 'individual' })); setStep(STEPS.ACCOUNT); }}
                  className="w-full p-5 rounded-xl border-2 text-left transition-all hover:border-primary hover:bg-primary-50 border-gray-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center">
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
                  onClick={() => { setFormData(prev => ({ ...prev, accountType: 'business' })); setStep(STEPS.ACCOUNT); }}
                  className="w-full p-5 rounded-xl border-2 text-left transition-all hover:border-primary hover:bg-primary-50 border-gray-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">업체 회원</h3>
                      <p className="text-sm text-gray-500 mt-0.5">채용/업체 섭외 공고를 작성하고 관리합니다</p>
                    </div>
                  </div>
                </button>
              </div>
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
                    <label htmlFor="businessType" className="block text-sm font-medium text-text-primary mb-1.5">업종</label>
                    <select id="businessType" name="businessType" required value={formData.businessType} onChange={handleChange} className="input-field">
                      <option value="">업종을 선택하세요</option>
                      {BUSINESS_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-text-primary mb-1.5">업체명</label>
                    <input id="companyName" name="companyName" type="text" required value={formData.companyName} onChange={handleChange} placeholder="업체명을 입력하세요" className="input-field" />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="region" className="block text-sm font-medium text-text-primary mb-1.5">지역</label>
                <select id="region" name="region" required value={formData.region} onChange={handleChange} className="input-field">
                  <option value="">지역을 선택하세요</option>
                  {REGIONS.map((region) => (
                    <option key={region.value} value={region.value}>{region.label}</option>
                  ))}
                </select>
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

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-surface px-3 text-text-muted">또는</span></div>
        </div>

        {/* Login Link */}
        <p className="text-center text-sm text-text-secondary">
          이미 계정이 있으신가요?{' '}
          <Link href={ROUTES.LOGIN} className="font-medium text-primary hover:text-primary-dark transition-colors">로그인</Link>
        </p>
      </div>
    </div>
  );
}
