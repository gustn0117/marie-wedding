'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { SITE_MENU } from '@/shared/constants/siteMenu';
import type { AuthProfile } from './Header';
import NotificationBell from '@/features/notifications/components/NotificationBell';
import { useOutsideClick } from '@/shared/hooks/useOutsideClick';
import SiteMenuDrawer, { SITE_MENU_DRAWER_ID } from './SiteMenuDrawer';
import { clearMarieProfileCookie } from '@/shared/utils/cookieHelpers';
import { apiFetch } from '@/shared/utils/apiFetch';
import { loginHref } from '@/shared/utils/loginRedirect';

interface HeaderClientProps {
  initialProfile: AuthProfile | null;
}

/**
 * 헤더 한 줄 — 좌: 로고 / 가운데: 주 메뉴 + 전체메뉴·검색 버튼 / 우: 계정.
 * 검색과 전체 하위 메뉴는 오른쪽에서 열리는 드로어(SiteMenuDrawer)에 있다.
 * 높이는 --header-h 한 곳에서 정한다 (sticky 요소들이 같은 값을 참조).
 */
export default function HeaderClient({ initialProfile }: HeaderClientProps) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<AuthProfile | null>(initialProfile);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Server Component가 최신 프로필로 다시 렌더되면 로컬 상태도 즉시 동기화한다.
  // useState의 초깃값은 첫 마운트에만 반영되므로 이 동기화가 없으면 저장 후에도
  // 헤더 이름·프로필 이미지가 이전 값에 머물 수 있다.
  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  // 옛 패턴 (<div className="fixed inset-0 z-10" onClick={close} />)은 본문 첫 클릭을 흡수.
  // ref-based outside-click으로 본문 카드/링크 클릭을 정상 통과시킴.
  const closeProfileMenu = useCallback(() => setProfileMenuOpen(false), []);
  const profileMenuRef = useOutsideClick<HTMLDivElement>(profileMenuOpen, closeProfileMenu);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => {
    setProfileMenuOpen(false);
    setMenuOpen(true);
  }, []);

  const isAuthenticated = !!profile;

  const signOut = useCallback(async () => {
    // 클라이언트 측 즉시 정리 (UI 반응 보장)
    clearMarieProfileCookie();
    setProfile(null);
    setProfileMenuOpen(false);

    // localStorage / sessionStorage의 supabase 세션 토큰 모두 제거
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-')) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('sb-')) sessionStorage.removeItem(k);
      });
    } catch {}

    // 서버 라우트가 세션 revoke + httpOnly 쿠키(sb-*, marie_profile) 만료를 모두 처리한다.
    // 이것만 기다리고(보통 ~100ms) 즉시 이동 — 클라 supabase.auth.signOut()(GoTrue revoke)은
    // 서버가 이미 수행하므로 생략. (이전엔 이 2초 대기 때문에 헤더 변경 후 ~1초 지연 발생)
    try {
      await apiFetch('/api/auth/signout', { method: 'POST', credentials: 'include' }, 2000);
    } catch {
      // 무시 — full reload 로 미들웨어가 다시 처리
    }

    window.location.href = '/';
  }, []);

  const displayName = profile?.company_name || profile?.contact_name || '';
  const initial = displayName.charAt(0) || '?';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="shell-wide h-[var(--header-h)] flex items-center gap-3 lg:gap-6">
        {/* 좌측: 로고 */}
        <Link href={ROUTES.HOME} aria-label="Marié 홈" className="flex shrink-0 flex-col justify-center text-ink">
          <span className="text-[24px] lg:text-[26px] font-bold leading-none tracking-tight">Marié</span>
          <span className="hidden lg:block mt-1.5 text-[10.5px] font-semibold leading-none text-gray-500">
            웨딩 구인구직 플랫폼
          </span>
        </Link>

        {/* 가운데: 주 메뉴 + 전체메뉴·검색 */}
        <div className="hidden lg:flex flex-1 items-center justify-center self-stretch">
          <nav aria-label="주 메뉴" className="flex h-full items-stretch gap-7 xl:gap-10">
            {SITE_MENU.map((s) => {
              const label = s.navLabel ?? s.label;
              const base =
                "relative inline-flex items-center gap-1 whitespace-nowrap text-[16px] xl:text-[17px] font-bold text-gray-900 transition-colors hover:text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[2px]";
              if (s.external) {
                return (
                  <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" className={`${base} after:bg-transparent`}>
                    {label}
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                );
              }
              const isActive = pathname === s.href || pathname.startsWith(`${s.href}/`);
              return (
                <Link
                  key={s.id}
                  href={s.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${base} ${isActive ? 'after:bg-ink' : 'after:bg-transparent'}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <MenuButton open={menuOpen} onClick={openMenu} className="ml-6 xl:ml-10" />
        </div>

        {/* 우측: 계정 */}
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
          {isAuthenticated ? (
            <>
              <NotificationBell />
              <div ref={profileMenuRef} className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex h-11 items-center gap-1"
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  aria-label="내 계정 메뉴"
                >
                  {profile.profile_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 border border-gray-200 flex items-center justify-center text-sm font-bold text-primary">
                      {initial}
                    </span>
                  )}
                  <svg className={`w-3 h-3 text-gray-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {profileMenuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 shadow-lg z-20 rounded-xl overflow-hidden">
                    <Link href={ROUTES.MYPAGE} onClick={() => setProfileMenuOpen(false)} className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{profile.account_type === 'business' ? '기업회원' : '개인회원'}</p>
                    </Link>
                    <Link href={ROUTES.MYPAGE_EDIT} onClick={() => setProfileMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">프로필 관리</Link>
                    {profile.account_type === 'business' && (
                      <Link href={ROUTES.JOBS_NEW} onClick={() => setProfileMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">공고 등록</Link>
                    )}
                    {profile.account_type === 'individual' && (
                      <Link href={ROUTES.MYPAGE_RESUMES} onClick={() => setProfileMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">이력서 관리</Link>
                    )}
                    <Link href={ROUTES.MYPAGE} onClick={() => setProfileMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      {profile.account_type === 'business' ? '받은 지원 / 내 활동' : '내 지원 / 활동'}
                    </Link>
                    {profile.role === 'admin' && (
                      <Link href={ROUTES.ADMIN} onClick={() => setProfileMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">관리자 패널</Link>
                    )}
                    <button type="button" onClick={signOut} className="block w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 border-t border-gray-100">로그아웃</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center text-[14px] text-gray-700">
              {/* 로그인 후 보던 페이지로 돌아온다. 사이트 안 이동이면 보던 화면 위에 로그인 창으로 뜬다(@modal) */}
              <Link href={loginHref(pathname)} className="inline-flex h-11 items-center px-2 transition-colors hover:text-ink">
                로그인
              </Link>
              <span aria-hidden className="hidden sm:block h-3 w-px bg-gray-300" />
              <Link href={ROUTES.SIGNUP} className="hidden sm:inline-flex h-11 items-center px-2 transition-colors hover:text-ink">
                회원가입
              </Link>
            </div>
          )}

          {/* lg 미만: 가운데 메뉴가 없으므로 버튼을 오른쪽 끝에 */}
          <MenuButton open={menuOpen} onClick={openMenu} className="lg:hidden" />
        </div>
      </div>

      <SiteMenuDrawer open={menuOpen} onClose={closeMenu} profile={profile} onSignOut={signOut} />
    </header>
  );
}

/** 전체메뉴(≡) + 검색(Q) 버튼 */
function MenuButton({ open, onClick, className = '' }: { open: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="전체 메뉴·검색 열기"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={SITE_MENU_DRAWER_ID}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-gray-100 ${className}`}
    >
      <svg className="h-6 w-7" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d="M2 6h9M2 12h9M2 18h9" />
        <circle cx="19" cy="11" r="5.5" />
        <path d="M23 15l3.5 3.5" />
      </svg>
    </button>
  );
}
