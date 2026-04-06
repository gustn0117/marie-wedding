'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants';
import type { AuthProfile } from './Header';

const NAV_LINKS = [
  { href: `${ROUTES.JOBS}?type=hiring`, label: '채용' },
  { href: `${ROUTES.JOBS}?type=matching`, label: '업체 섭외' },
  { href: ROUTES.DIRECTORY, label: '디렉토리' },
  { href: ROUTES.EVENTS, label: '이벤트' },
  { href: ROUTES.COMMUNITY, label: '커뮤니티' },
] as const;

interface HeaderClientProps {
  initialProfile: AuthProfile | null;
}

export default function HeaderClient({ initialProfile }: HeaderClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<AuthProfile | null>(initialProfile);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAuthenticated = !!profile;

  const isActive = (href: string) => {
    const path = href.split('?')[0];
    return pathname.startsWith(path);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`${ROUTES.JOBS}?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear profile cookie
    document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setProfile(null);
    setProfileMenuOpen(false);
    router.push('/login');
    router.refresh();
  }, [router]);

  return (
    <header className="sticky top-0 z-50 bg-white">
      {/* Top Header: Logo + Search + Auth */}
      <div className="border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 relative flex items-center h-[64px]">
          {/* Logo */}
          <Link href={ROUTES.HOME} className="shrink-0">
            <span className="font-serif text-[28px] font-bold text-primary tracking-wide">Marié</span>
          </Link>

          {/* Search Bar - Absolute Center */}
          <form onSubmit={handleSearch} className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-full max-w-[520px]">
            <div className="flex w-full bg-gray-50 border border-gray-200 rounded-full overflow-hidden focus-within:border-primary focus-within:bg-white transition-all">
              <div className="flex items-center pl-5 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="웨딩 업계 맞춤 채용, Marié!"
                className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
              />
              <button
                type="submit"
                className="px-5 py-2 text-sm font-medium text-primary hover:text-primary-light transition-colors"
              >
                검색
              </button>
            </div>
          </form>

          {/* Auth Links - Right */}
          <div className="hidden md:flex items-center gap-1 absolute right-4 shrink-0 text-sm">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-xs">
                    {profile.contact_name?.charAt(0) || '?'}
                  </span>
                  <span className="font-medium">{profile.contact_name || '마이페이지'}</span>
                </button>
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-xl z-20 overflow-hidden">
                      {/* Profile Header */}
                      <div className="px-4 py-4 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {profile.contact_name?.charAt(0) || '?'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{profile.company_name || profile.contact_name}</p>
                            <p className="text-xs text-gray-500 truncate">{profile.account_type === 'business' ? '업체 회원' : '개인 회원'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                        <Link
                          href={ROUTES.MYPAGE}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          마이페이지
                        </Link>
                        <Link
                          href={ROUTES.MYPAGE_EDIT}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          프로필 설정
                        </Link>
                        {profile.role === 'admin' && (
                          <Link
                            href={ROUTES.ADMIN}
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                            </svg>
                            관리자
                          </Link>
                        )}
                      </div>

                      {/* Logout */}
                      <div className="border-t border-gray-100">
                        <button
                          onClick={signOut}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                          </svg>
                          로그아웃
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link href={ROUTES.LOGIN} className="px-3 py-1.5 text-gray-500 hover:text-gray-900 transition-colors">
                  로그인
                </Link>
                <span className="text-gray-200">|</span>
                <Link href={ROUTES.SIGNUP} className="px-3 py-1.5 text-gray-500 hover:text-gray-900 transition-colors">
                  회원가입
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded text-gray-600 hover:bg-gray-50 transition-colors ml-auto"
            aria-label="메뉴 열기"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-[1200px] mx-auto px-4">
          <nav className="hidden md:flex items-center justify-center h-[46px] gap-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`relative px-4 py-2 text-[15px] font-semibold transition-colors ${
                  isActive(link.href)
                    ? 'text-primary'
                    : 'text-gray-700 hover:text-primary'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 shadow-lg">
          <form onSubmit={handleSearch} className="px-4 pt-3">
            <div className="flex bg-gray-50 border border-gray-200 rounded-full overflow-hidden">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="채용공고, 업체명으로 검색"
                className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent"
              />
              <button type="submit" className="px-4 text-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>
            </div>
          </form>
          <nav className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                  isActive(link.href) ? 'text-primary bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-gray-100">
            {isAuthenticated ? (
              <div className="space-y-2">
                <Link href={ROUTES.MYPAGE} onClick={() => setMobileMenuOpen(false)}
                  className="block text-center px-4 py-2.5 text-sm font-medium border border-gray-300 rounded hover:bg-gray-50 transition-colors">마이페이지</Link>
                <Link href={ROUTES.JOBS_NEW} onClick={() => setMobileMenuOpen(false)}
                  className="block text-center btn-primary text-sm">공고 등록하기</Link>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link href={ROUTES.LOGIN} onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center px-4 py-2.5 text-sm font-medium border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                  로그인
                </Link>
                <Link href={ROUTES.SIGNUP} onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center btn-primary text-sm">
                  회원가입
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
