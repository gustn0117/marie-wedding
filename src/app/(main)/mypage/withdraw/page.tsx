import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import AccountWithdrawalSection from '@/features/mypage/components/AccountWithdrawalSection';

export const metadata = {
  title: '회원 탈퇴 | Marié',
};

export default function WithdrawPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <nav className="flex items-center gap-2 text-sm">
        <Link href={ROUTES.MYPAGE} className="text-gray-500 hover:text-primary transition-colors">
          마이페이지
        </Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium">회원 탈퇴</span>
      </nav>

      <div className="bg-white border border-gray-200 rounded p-6 md:p-8">
        <h1 className="text-2xl font-bold text-ink mb-2">회원 탈퇴</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          탈퇴를 진행하시기 전에 안내사항을 확인해 주세요.
          탈퇴 후에는 동일한 정보로 복구할 수 없습니다.
        </p>
      </div>

      <AccountWithdrawalSection />
    </main>
  );
}
