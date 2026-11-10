import Link from 'next/link';
import LoginForm from '@/features/auth/components/LoginForm';
import AppTopBar from '@/shared/components/AppTopBar';
import { ROUTES } from '@/shared/constants';

export const metadata = {
  title: '로그인',
  description: '마리에 웨딩 구인구직 플랫폼에 로그인하세요.',
};

export default function LoginPage() {
  return (
    <main className="app-under-topbar min-h-screen flex items-center justify-center bg-background px-4 py-12">
      {/* 앱 전용 뒤로 막대 — 이 화면엔 사이트 머리글이 없다 */}
      <AppTopBar />
      <div className="w-full max-w-md">
        <LoginForm />
        {/* 앱: 로그인 전에도 고객센터·약관을 열 수 있게(웹은 바닥글에 있다) */}
        <nav
          aria-label="도움말"
          className="app-only mt-4 flex flex-wrap items-center justify-center gap-x-1 text-[13px] text-gray-500"
        >
          <Link href={ROUTES.CONTACT} className="px-2 py-2">고객센터</Link>
          <Link href="/terms" className="px-2 py-2">이용약관</Link>
          <Link href="/privacy" className="px-2 py-2">개인정보처리방침</Link>
        </nav>
      </div>
    </main>
  );
}
