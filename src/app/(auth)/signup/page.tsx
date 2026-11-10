import SignupForm from '@/features/auth/components/SignupForm';
import AppTopBar from '@/shared/components/AppTopBar';

export const metadata = {
  title: '회원가입',
  description: '마리에 웨딩 구인구직 플랫폼에 가입하세요.',
};

export default function SignupPage() {
  return (
    <main className="app-under-topbar min-h-screen flex items-center justify-center bg-background px-4 py-12">
      {/* 앱 전용 뒤로 막대 — 이 화면엔 사이트 머리글이 없다 */}
      <AppTopBar />
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </main>
  );
}
