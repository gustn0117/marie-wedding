'use client';

import { Suspense, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import type { AuthProfile } from './Header';
import NotificationBell from '@/features/notifications/components/NotificationBell';
import { useOutsideClick } from '@/shared/hooks/useOutsideClick';
import MobileNavPanel from './MobileNavPanel';
import { clearMarieProfileCookie } from '@/shared/utils/cookieHelpers';

// 헤더 2단 nav — 좌측: 구인구직 중심 정보 구조 / 우측: 외부 제휴업체 1건만
const CAT_NAV = [
  { href: ROUTES.JOBS, label: '채용정보' },
  { href: ROUTES.DIRECTORY, label: '인재·업체 프로필' },
  { href: ROUTES.COMMUNITY, label: '커뮤니티' },
  { href: ROUTES.EVENTS, label: '행사·박람회' },
] as const;

// 외부 링크 — haramevent.kr 로 새 탭 이동
const PARTNER_NAV = [
  { href: 'https://haramevent.kr', label: '웨딩 컨시어지(예식도우미)', external: true },
] as const;

// CAT_NAV href에서 path + 첫 query param을 분해. active 비교 시 정확 매칭에 사용.
interface HeaderClientProps {
  initialProfile: AuthProfile | null;
}

export default function HeaderClient({ initialProfile }: HeaderClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  // useSearchParams는 별도 컴포넌트(CatNavLinks)로 분리해서 Suspense 안에서만 호출.
  // 이전: HeaderClient 본문에서 직접 호출 → prerender(static export) 시 throw → 빌드 실패.
  const [profile, setProfile] = useState<AuthProfile | null>(initialProfile);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 옛 패턴 (<div className="fixed inset-0 z-10" onClick={close} />)은 본문 첫 클릭을 흡수.
  // ref-based outside-click으로 본문 카드/링크 클릭을 정상 통과시킴.
  const closeProfileMenu = useCallback(() => setProfileMenuOpen(false), []);
  const profileMenuRef = useOutsideClick<HTMLDivElement>(profileMenuOpen, closeProfileMenu);

  const isAuthenticated = !!profile;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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
      await Promise.race([
        fetch('/api/auth/signout', { method: 'POST', credentials: 'include' }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('signout_timeout')), 2000)),
      ]);
    } catch {
      // 무시 — full reload 로 미들웨어가 다시 처리
    }

    window.location.href = '/';
  }, []);

  const displayName = profile?.company_name || profile?.contact_name || '';
  const initial = displayName.charAt(0) || '?';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      {/* 1단: 모바일 = flex justify-between (로고·메뉴 양 끝 정렬)
              md+ = 3-col grid (로고 | 검색바 정중앙 | 메뉴) */}
      <div className="shell-wide h-[var(--header-h)] flex items-center justify-between gap-4 md:grid md:grid-cols-[auto_1fr_auto]">
        {/* 좌측: 로고 + 태그라인 */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href={ROUTES.HOME} className="text-2xl font-bold tracking-tight text-ink">
            Marié
          </Link>
          <span className="hidden md:inline text-gray-300">|</span>
          <span className="hidden md:inline text-sm font-semibold text-gray-700">
            웨딩 구인구직 플랫폼
          </span>
        </div>

        {/* 가운데: 검색바 (정중앙) */}
        <form onSubmit={handleSearch} className="hidden md:flex justify-center">
          <label className="header-search w-full max-w-[480px]">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="업체명, 직무, 지역 검색"
              className="bg-transparent border-none outline-none flex-1 text-[14px] placeholder:text-gray-500 text-ink"
            />
          </label>
        </form>

        {/* 우측: 메뉴 */}
        <nav className="flex items-center gap-1 shrink-0">
          {isAuthenticated && profile?.account_type === 'business' && (
            <Link href={ROUTES.JOBS_NEW} className="hidden lg:inline-flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-ink px-3 py-2">
              공고 등록<span className="text-sm font-semibold text-gray-700">(채용)</span>
            </Link>
          )}
          <Link href={ROUTES.MYPAGE} className="hidden lg:inline-flex text-sm font-semibold text-gray-700 hover:text-ink px-3 py-2">
            마이페이지
          </Link>
          <Link href={ROUTES.COMMUNITY} className="icon-btn" aria-label="커뮤니티">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </Link>
          {isAuthenticated && <NotificationBell profileId={profile.id} />}
          {isAuthenticated && (
            <Link href={ROUTES.MYPAGE_BOOKMARKS} className="icon-btn" aria-label="저장한 항목">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </Link>
          )}

          {isAuthenticated ? (
            <div ref={profileMenuRef} className="relative ml-1">
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-1"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
              >
                {profile.profile_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 border border-gray-200 flex items-center justify-center text-sm font-bold text-primary">
                    {initial}
                  </span>
                )}
                <svg className={`w-3 h-3 text-gray-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
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
          ) : (
            <Link href={ROUTES.LOGIN} className="ml-1 px-4 h-9 inline-flex items-center text-sm font-bold border border-gray-300 hover:border-ink rounded-full">
              로그인
            </Link>
          )}

          {/* 모바일 햄버거 → X morph */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden ml-1 icon-btn relative"
            aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
          >
            <svg className={`w-5 h-5 absolute transition-all duration-200 ${mobileMenuOpen ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            <svg className={`w-5 h-5 absolute transition-all duration-200 ${mobileMenuOpen ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </nav>
      </div>

      {/* 2단: 카테고리 nav — 모든 페이지에서 동일 렌더 (CLS 0).
          이전엔 isHomeLike에서만 렌더 → 페이지 이동 시 헤더 높이 68→116 점프. */}
      <div className="border-t border-gray-100 hidden md:block">
        <div className="shell-wide flex items-center gap-1">
          <Link href={ROUTES.HOME} className={`cat-nav-link ${pathname === '/' ? 'cat-nav-link-active' : ''}`}>
            홈
          </Link>
          <Suspense fallback={<CatNavLinksFallback />}>
            <CatNavLinks pathname={pathname} />
          </Suspense>
          {/* 우측 — 제휴업체 (외부 링크) */}
          <div className="ml-auto flex items-center gap-1 pl-3 border-l border-gray-100">
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase pr-1">제휴업체</span>
            {PARTNER_NAV.map((p) => (
              <a
                key={p.href}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="cat-nav-link inline-flex items-center gap-1"
              >
                {p.label}
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 모바일 슬라이드 다운 패널 — Workflow 결과 spec 구현 */}
      <MobileNavPanel
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        profile={profile}
        onSignOut={signOut}
      />
    </header>
  );
}

/**
 * CAT_NAV active 매칭 컴포넌트 — useSearchParams를 분리.
 * Next.js 14에서 useSearchParams를 사용하는 컴포넌트는 Suspense 안에 있어야 하며,
 * 그렇지 않으면 prerender 시 "should be wrapped in a suspense boundary" 에러로 빌드 실패.
 *
 * 본 컴포넌트는 HeaderClient에서 <Suspense>로 감싸 호출됨.
 * Server에서 prerender 시점엔 fallback(CatNavLinksFallback)이 렌더되고,
 * 클라이언트 hydration 후 실제 active 상태가 반영됨.
 */
function CatNavLinks({ pathname }: { pathname: string }) {
  // CAT_NAV는 query 없는 단순 경로만 사용 — searchParams 의존 제거.
  return (
    <>
      {CAT_NAV.map((c) => {
        const isActive = pathname === c.href || pathname.startsWith(c.href + '/');
        return (
          <Link
            key={c.label}
            href={c.href}
            className={`cat-nav-link ${isActive ? 'cat-nav-link-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {c.label}
          </Link>
        );
      })}
    </>
  );
}

/**
 * Suspense fallback — searchParams 사용 불가한 prerender 시점에 렌더.
 * 모든 링크를 active 표시 없이 렌더 → hydration 후 진짜 active 상태로 자연스럽게 교체.
 */
function CatNavLinksFallback() {
  return (
    <>
      {CAT_NAV.map((c) => (
        <Link key={c.label} href={c.href} className="cat-nav-link">
          {c.label}
        </Link>
      ))}
    </>
  );
}
