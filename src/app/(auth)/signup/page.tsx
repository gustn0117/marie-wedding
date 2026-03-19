import SignupForm from '@/features/auth/components/SignupForm';

export const metadata = {
  title: '회원가입 - Marie',
  description: '마리에 웨딩 B2B 플랫폼에 가입하세요.',
};

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </main>
  );
}
