import ResetPasswordForm from '@/features/auth/components/ResetPasswordForm';

export const metadata = {
  title: '새 비밀번호 설정',
};

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
