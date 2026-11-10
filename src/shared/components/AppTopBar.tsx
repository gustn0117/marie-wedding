import AppBackButton from './AppBackButton';

/**
 * 앱 전용 위 막대(뒤로 버튼) — 사이트 머리글이 없는 화면(로그인·회원가입)에 둔다.
 * 그 화면의 본문에는 .app-under-topbar 를 달아 이 막대(상태 표시줄 + 48px) 아래에서 시작하게 한다.
 */
export default function AppTopBar() {
  return (
    <div className="app-only fixed inset-x-0 top-0 z-header bg-background pt-[var(--app-top)]">
      <div className="flex h-12 items-center px-2">
        <AppBackButton />
      </div>
    </div>
  );
}
