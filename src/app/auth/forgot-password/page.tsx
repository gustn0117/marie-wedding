import ForgotPasswordForm from '@/features/auth/components/ForgotPasswordForm';

export const metadata = {
  title: '비밀번호 찾기 | Marié',
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
