'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';

const NAV_LINKS = [
  { href: `${ROUTES.JOBS}?type=hiring`, label: '채용' },
  { href: `${ROUTES.JOBS}?type=matching`, label: '업체 섭외' },
  { href: ROUTES.DIRECTORY, label: '디렉토리' },
  { href: ROUTES.EVENTS, label: '이벤트' },
  { href: ROUTES.COMMUNITY, label: '커뮤니티' },
] as const;

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isLoading, isAuthenticated, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (href: string) => {
    const path = href.split('?')[0];
    return pathname.startsWith(path);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`${ROUTES.JOBS}?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white">
      {/* Top Header: Logo + Search + Auth */}
      <div className="border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 flex items-center h-[64px] gap-6">
          {/* Logo */}
          <Link href={ROUTES.HOME} className="shrink-0">
            <span className="font-serif text-[28px] font-bold text-primary tracking-wide">Marié</span>
          </Link>

          {/* Search Bar - Center */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-[580px]">
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
          <div className="hidden md:flex items-center gap-1 ml-auto shrink-0 text-sm">
            {isLoading ? (
              <div className="w-20 h-8 bg-gray-100 rounded animate-pulse" />
            ) : isAuthenticated && profile ? (
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-xs">
                    {profile.contact_name.charAt(0)}
                  </span>
                  <span className="font-medium">{profile.contact_name}</span>
                </button>
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-800 truncate">{profile.company_name}</p>
                        <p className="text-xs text-gray-500 truncate">{profile.contact_name}</p>
                      </div>
                      <button
                        onClick={() => { setProfileMenuOpen(false); signOut(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        로그아웃
                      </button>
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
              <Link href={ROUTES.JOBS_NEW} onClick={() => setMobileMenuOpen(false)}
                className="block text-center btn-primary text-sm">공고 등록하기</Link>
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
