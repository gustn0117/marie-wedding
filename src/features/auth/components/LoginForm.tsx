'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authService } from '@/features/auth/services/auth-service';
import { ROUTES } from '@/shared/constants';
import type { LoginFormData } from '@/features/auth/types';

export default function LoginForm() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await authService.signIn(formData.email, formData.password);
      window.location.href = ROUTES.HOME;
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else {
          setError(err.message);
        }
      } else {
        setError('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-surface rounded-2xl border border-border p-8 shadow-lg">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Link href={ROUTES.HOME} className="inline-block">
            <h1 className="font-serif text-3xl font-bold text-primary tracking-wide">Marié</h1>
          </Link>
          <p className="mt-2 text-sm text-text-secondary">
            웨딩업계 B2B 플랫폼
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요"
              className="input-field"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-3 text-text-muted">
              소셜 계정으로 간편 로그인
            </span>
          </div>
        </div>

        {/* Social Login */}
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={async () => {
              try {
                await authService.signInWithKakao();
              } catch {
                setError('카카오 로그인에 실패했습니다.');
              }
            }}
            className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center hover:opacity-80 transition-opacity"
            title="카카오 로그인"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.8 5.16 4.5 6.54-.18.66-.66 2.4-.75 2.76-.12.48.18.48.36.36.15-.09 2.34-1.59 3.3-2.25.84.12 1.71.18 2.59.18 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" fill="#3C1E1E"/>
            </svg>
          </button>
        </div>

        <div className="mt-6" />

        {/* Signup Link */}
        <p className="text-center text-sm text-text-secondary">
          아직 계정이 없으신가요?{' '}
          <Link
            href={ROUTES.SIGNUP}
            className="font-medium text-primary hover:text-primary-dark transition-colors"
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
