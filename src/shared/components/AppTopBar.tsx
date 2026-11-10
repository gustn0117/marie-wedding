import AppBackButton from './AppBackButton';

/**
 * 앱 전용 위 막대(뒤로 버튼) — 사이트 머리글이 없는 화면(로그인·회원가입)에 둔다.
 * 높이·반투명 바탕은 다른 화면의 앱 위 막대(AppNavBar)와 같다(--header-row-h, .app-topbar).
 * 그 화면의 본문에는 .app-under-topbar 를 달아 이 막대(상태 표시줄 + 막대 높이) 아래에서 시작하게 한다.
 */
export default function AppTopBar() {
  return (
    <div className="app-only app-topbar fixed inset-x-0 top-0 z-header pt-[var(--app-top)]">
      <div className="flex h-[var(--header-row-h)] items-center px-1.5">
        <AppBackButton />
      </div>
    </div>
  );
}
