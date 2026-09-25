import LoginModal from '@/features/auth/components/LoginModal';
import LoginForm from '@/features/auth/components/LoginForm';

// 사이트 안에서 /login 으로 이동하면(링크·router.push) 보던 화면 위에 로그인 창을 띄운다.
// 직접 접속·새로고침은 가로채지 않으므로 (auth)/login 페이지가 뜬다.
export default function LoginModalRoute() {
  return (
    <LoginModal>
      <LoginForm variant="modal" />
    </LoginModal>
  );
}
