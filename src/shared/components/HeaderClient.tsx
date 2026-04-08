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
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  {profile.profile_image ? (
                    <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-semibold text-xs">
                      {profile.contact_name?.charAt(0) || '?'}
                    </span>
                  )}
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-gray-700 leading-tight">{profile.contact_name || '마이페이지'}</p>
                    {profile.company_name && (
                      <p className="text-[11px] text-gray-400 leading-tight">{profile.company_name}</p>
                    )}
                  </div>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-gray-100 shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Profile Header */}
                      <Link
                        href={ROUTES.MYPAGE}
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
                      >
                        {profile.profile_image ? (
                          <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-bold text-base shrink-0">
                            {profile.contact_name?.charAt(0) || '?'}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold text-gray-900 truncate">{profile.company_name || profile.contact_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{profile.account_type === 'business' ? '업체 회원' : '개인 회원'} · 프로필 보기</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>

                      <div className="h-px bg-gray-100" />

                      {/* Menu Items */}
                      <div className="py-1.5 px-2">
                        <Link
                          href={ROUTES.MYPAGE_EDIT}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                          프로필 수정
                        </Link>
                        <Link
                          href={ROUTES.MYPAGE_PASSWORD}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          비밀번호 변경
                        </Link>
                        {profile.role === 'admin' && (
                          <Link
                            href={ROUTES.ADMIN}
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                            </svg>
                            관리자 패널
                          </Link>
                        )}
                      </div>

                      <div className="h-px bg-gray-100" />

                      {/* Logout */}
                      <div className="px-2 py-1.5">
                        <button
                          onClick={signOut}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
