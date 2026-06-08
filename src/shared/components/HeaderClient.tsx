'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants';
import type { AuthProfile } from './Header';
import NotificationBadge from '@/features/notifications/components/NotificationBadge';
import { useOutsideClick } from '@/shared/hooks/useOutsideClick';

// 주의: '노하우' category=tips (복수) — POST_CATEGORIES 정의와 일치.
// 이전엔 ?category=tip(단수)이라 커뮤니티 페이지에서 eq('category', 'tip') 매칭이 0건이었음.
const CAT_NAV = [
  { href: ROUTES.JOBS, label: '전체', icon: '🗂' },
  { href: `${ROUTES.JOBS}?businessType=designer`, label: '디자인' },
  { href: `${ROUTES.COMMUNITY}?category=tips`, label: '노하우' },
  { href: `${ROUTES.JOBS}?businessType=studio`, label: '스튜디오' },
  { href: `${ROUTES.JOBS}?businessType=makeup`, label: '메이크업' },
  { href: `${ROUTES.JOBS}?businessType=planner`, label: '플래너' },
  { href: `${ROUTES.JOBS}?businessType=mc`, label: '사회·축가' },
  { href: `${ROUTES.JOBS}?type=matching`, label: '파트너 섭외' },
] as const;

// CAT_NAV href에서 path + 첫 query param을 분해. active 비교 시 정확 매칭에 사용.
function parseNavHref(href: string): { path: string; queryKey: string | null; queryValue: string | null } {
  const [path, search] = href.split('?');
  if (!search) return { path, queryKey: null, queryValue: null };
  const [k, v] = search.split('=');
  return { path, queryKey: k ?? null, queryValue: v ?? null };
}

interface HeaderClientProps {
  initialProfile: AuthProfile | null;
}

export default function HeaderClient({ initialProfile }: HeaderClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<AuthProfile | null>(initialProfile);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 옛 패턴 (<div className="fixed inset-0 z-10" onClick={close} />)은 본문 첫 클릭을 흡수.
  // ref-based outside-click으로 본문 카드/링크 클릭을 정상 통과시킴.
  const closeProfileMenu = useCallback(() => setProfileMenuOpen(false), []);
  const profileMenuRef = useOutsideClick<HTMLDivElement>(profileMenuOpen, closeProfileMenu);

  const isAuthenticated = !!profile;
  const isHomeLike = pathname === '/' || pathname.startsWith('/jobs') || pathname.startsWith('/directory') || pathname.startsWith('/community');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setProfile(null);
    setProfileMenuOpen(false);
    window.location.href = '/';
  }, []);

  const displayName = profile?.company_name || profile?.contact_name || '';
  const initial = displayName.charAt(0) || '?';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      {/* 1단: 로고 + 검색바 + 우측 메뉴 */}
      <div className="max-w-[1280px] mx-auto px-5 h-[68px] flex items-center gap-5">
        <Link href={ROUTES.HOME} className="text-2xl font-extrabold tracking-tight text-ink shrink-0">
          Marié
        </Link>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <span className="text-gray-300">|</span>
          <Link href={`${ROUTES.JOBS}?type=matching`} className="text-sm font-semibold text-gray-700 hover:text-ink">
            파트너 섭외
          </Link>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-[480px] hidden md:block">
          <label className="header-search">
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

        <nav className="ml-auto flex items-center gap-1 shrink-0">
          <Link href={`${ROUTES.JOBS}?type=matching`} className="hidden lg:inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-ink px-3 py-2">
            업체 섭외 <span className="text-[10px] font-bold text-primary bg-primary-50 px-1.5 py-0.5 rounded">B2B</span>
          </Link>
          <Link href={ROUTES.MYPAGE} className="hidden lg:inline-flex text-sm font-semibold text-gray-700 hover:text-ink px-3 py-2">
            업무 관리
          </Link>
          <Link href={ROUTES.COMMUNITY} className="icon-btn" aria-label="커뮤니티">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </Link>
          {isAuthenticated && (
            <Link href={ROUTES.MYPAGE_NOTIFICATIONS} className="icon-btn relative" aria-label="알림">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <NotificationBadge profileId={profile.id} />
            </Link>
          )}
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
                  <Link href={ROUTES.MYPAGE} onClick={() => setProfileMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">지원/문의 관리</Link>
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

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden ml-1 icon-btn"
            aria-label="메뉴"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </nav>
      </div>

      {/* 2단: 카테고리 nav */}
      {isHomeLike && (
        <div className="border-t border-gray-100 hidden md:block">
          <div className="max-w-[1280px] mx-auto px-5 flex items-center gap-1 overflow-x-auto">
            <Link href={ROUTES.HOME} className={`cat-nav-link flex items-center gap-1.5 ${pathname === '/' ? 'cat-nav-link-active' : ''}`}>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500 text-white text-[10px]">🌿</span>
              업종별
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </Link>
            {CAT_NAV.map((c) => {
              // 정확 매칭: pathname이 일치하고 query param도 일치할 때만 active.
              // 이전: pathname.startsWith로만 비교 → /jobs?businessType=X일 때
              // 모든 jobs 서브카테고리(디자인·스튜디오·메이크업·플래너·...) 동시 활성화 버그.
              const { path, queryKey, queryValue } = parseNavHref(c.href);
              const isActive = pathname === path && (
                queryKey === null
                  ? !searchParams.toString() || c.href === ROUTES.JOBS
                  : searchParams.get(queryKey) === queryValue
              );
              return (
                <Link
                  key={c.label}
                  href={c.href}
                  className={`cat-nav-link ${isActive ? 'cat-nav-link-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {'icon' in c && c.icon ? <><span className="mr-1">{c.icon}</span>{c.label}</> : c.label}
                </Link>
              );
            })}
            <Link href={ROUTES.DIRECTORY} className={`cat-nav-link ml-auto ${pathname.startsWith('/directory') ? 'cat-nav-link-active' : ''}`}>디렉토리</Link>
            <Link href={ROUTES.COMMUNITY} className={`cat-nav-link ${pathname.startsWith('/community') ? 'cat-nav-link-active' : ''}`}>커뮤니티</Link>
            <Link href={`${ROUTES.JOBS}?type=matching`} className="cat-nav-link">파트너 섭외</Link>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3">
            <form onSubmit={handleSearch}>
              <label className="header-search">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="검색" className="bg-transparent outline-none flex-1 text-sm" />
              </label>
            </form>
          </div>
          <nav className="grid grid-cols-2 gap-1 px-4 pb-4">
            {CAT_NAV.map((c) => (
              <Link key={c.label} href={c.href} onClick={() => setMobileMenuOpen(false)} className="px-3 py-3 rounded border border-gray-200 text-sm font-bold text-gray-700">{c.label}</Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
