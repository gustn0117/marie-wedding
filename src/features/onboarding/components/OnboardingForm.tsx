'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AccountType } from '@/shared/constants';

interface Props {
  initialName: string;
  next: string;
  userId: string;
}

/**
 * 3필드 미니멀 온보딩.
 *  1. 계정 유형 카드 2개 (역할 중심 라벨)
 *  2. 이름 / 회사명
 *  3. 휴대폰 (형식 검증만 — SMS 인증은 just-in-time)
 *
 * 지역·업종·사업자번호·SMS 인증은 모두 just-in-time 트리거로 미룬다.
 */
export default function OnboardingForm({ initialName, next, userId }: Props) {
  void userId; // 서버 API에서 session으로 확인
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const phoneOk = /^010-?\d{3,4}-?\d{4}$/.test(phone.trim());
  const nameOk = name.trim().length >= 2;
  const canSubmit = !!accountType && nameOk && phoneOk;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startSubmit(async () => {
      try {
        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountType,
            name: name.trim(),
            phone: phone.trim().replace(/-/g, ''),
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error || '저장에 실패했습니다.');
        }
        router.replace(next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="text-sm font-bold text-ink mb-3">계정 유형을 선택해주세요</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AccountCard
            value="individual"
            current={accountType}
            onChange={setAccountType}
            title="일자리를 찾고 있어요"
            subtitle="플래너 · 도우미 · 프리랜서"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            }
          />
          <AccountCard
            value="business"
            current={accountType}
            onChange={setAccountType}
            title="직원 채용·업체 홍보"
            subtitle="예식장 · 드레스 · 스튜디오 · 메이크업"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            }
          />
        </div>
      </fieldset>

      {accountType && (
        <>
          <div>
            <label className="block text-sm font-bold text-ink mb-1.5">
              {accountType === 'business' ? '회사명' : '이름'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={accountType === 'business' ? '예) 마리에 웨딩홀' : '예) 김마리'}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 outline-none focus:border-ink"
              autoComplete="name"
              maxLength={40}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-ink mb-1.5">
              휴대폰 <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="w-full h-11 px-3 rounded-lg border border-gray-300 outline-none focus:border-ink"
              autoComplete="tel"
              inputMode="tel"
              maxLength={13}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              공고 지원·등록 시 본인 인증을 한 번 거쳐요.
            </p>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="w-full h-12 rounded-lg bg-ink text-white text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
      >
        {submitting ? '저장 중…' : '시작하기'}
      </button>
    </form>
  );
}

function AccountCard({
  value,
  current,
  onChange,
  title,
  subtitle,
  icon,
}: {
  value: AccountType;
  current: AccountType | '';
  onChange: (v: AccountType) => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-colors text-left ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-gray-200 bg-white text-ink hover:border-gray-400'
      }`}
      aria-pressed={active}
    >
      <svg
        className={`w-6 h-6 ${active ? 'text-white' : 'text-gray-700'}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
        stroke="currentColor"
      >
        {icon}
      </svg>
      <p className="text-sm font-bold">{title}</p>
      <p className={`text-[11px] ${active ? 'text-white/70' : 'text-gray-500'}`}>{subtitle}</p>
    </button>
  );
}
