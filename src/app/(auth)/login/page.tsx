import LoginForm from '@/features/auth/components/LoginForm';

export const metadata = {
  title: '로그인 - Marie',
  description: '마리에 웨딩 B2B 플랫폼에 로그인하세요.',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}
