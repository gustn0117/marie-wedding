'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/features/auth/services/auth-service';
import { ROUTES, BUSINESS_TYPES, REGIONS } from '@/shared/constants';
import type { SignupFormData } from '@/features/auth/types';

export default function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    businessType: '',
    companyName: '',
    contactName: '',
    region: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validateStep1 = (): boolean => {
    if (!formData.email) {
      setError('이메일을 입력해주세요.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return false;
    }
    if (!formData.password) {
      setError('비밀번호를 입력해주세요.');
      return false;
    }
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!formData.businessType) {
      setError('업종을 선택해주세요.');
      return false;
    }
    if (!formData.companyName.trim()) {
      setError('업체명을 입력해주세요.');
      return false;
    }
    if (!formData.contactName.trim()) {
      setError('담당자명을 입력해주세요.');
      return false;
    }
    if (!formData.region) {
      setError('지역을 선택해주세요.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateStep2()) return;

    setLoading(true);
    try {
      await authService.signUp(formData.email, formData.password, {
        businessType: formData.businessType,
        companyName: formData.companyName.trim(),
        contactName: formData.contactName.trim(),
        region: formData.region,
      });
      router.push(ROUTES.JOBS);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('already registered')) {
          setError('이미 가입된 이메일입니다.');
        } else {
          setError(err.message);
        }
      } else {
        setError('회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-surface rounded-2xl border border-border p-8 shadow-lg">
        {/* Logo / Brand */}
        <div className="text-center mb-6">
          <h1 className="font-serif text-3xl font-bold text-primary tracking-wide">
            Marie
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            웨딩업계 B2B 플랫폼 회원가입
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step >= 1
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-text-muted'
              }`}
            >
              1
            </div>
            <span className="text-xs text-text-secondary hidden sm:inline">계정 정보</span>
          </div>
          <div className={`w-8 h-0.5 transition-colors ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`} />
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step >= 2
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-text-muted'
              }`}
            >
              2
            </div>
            <span className="text-xs text-text-secondary hidden sm:inline">업체 정보</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 && (
            <>
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
                  이메일
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@company.com"
                  className="input-field"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">
                  비밀번호
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="6자 이상 입력하세요"
                  className="input-field"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-1.5">
                  비밀번호 확인
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="input-field"
                />
              </div>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary w-full"
              >
                다음
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Business Type */}
              <div>
                <label htmlFor="businessType" className="block text-sm font-medium text-text-primary mb-1.5">
                  업종
                </label>
                <select
                  id="businessType"
                  name="businessType"
                  required
                  value={formData.businessType}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">업종을 선택하세요</option>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Name */}
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-text-primary mb-1.5">
                  업체명
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="업체명을 입력하세요"
                  className="input-field"
                />
              </div>

              {/* Contact Name */}
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-text-primary mb-1.5">
                  담당자명
                </label>
                <input
                  id="contactName"
                  name="contactName"
                  type="text"
                  required
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="담당자명을 입력하세요"
                  className="input-field"
                />
              </div>

              {/* Region */}
              <div>
                <label htmlFor="region" className="block text-sm font-medium text-text-primary mb-1.5">
                  지역
                </label>
                <select
                  id="region"
                  name="region"
                  required
                  value={formData.region}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">지역을 선택하세요</option>
                  {REGIONS.map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="btn-outline flex-1"
                >
                  이전
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      가입 중...
                    </>
                  ) : (
                    '가입하기'
                  )}
                </button>
              </div>
            </>
          )}
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-3 text-text-muted">
              또는
            </span>
          </div>
        </div>

        {/* Login Link */}
        <p className="text-center text-sm text-text-secondary">
          이미 계정이 있으신가요?{' '}
          <Link
            href={ROUTES.LOGIN}
            className="font-medium text-primary hover:text-primary-dark transition-colors"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
