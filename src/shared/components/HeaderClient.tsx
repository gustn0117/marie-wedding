'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants';
import Logo from './Logo';
import type { AuthProfile } from './Header';

const NAV_LINKS = [
  { href: `${ROUTES.JOBS}?type=hiring`, label: '채용정보' },
  { href: `${ROUTES.JOBS}?type=matching`, label: '파트너 섭외' },
  { href: ROUTES.DIRECTORY, label: '업체정보' },
  { href: ROUTES.EVENTS, label: '이벤트' },
  { href: ROUTES.COMMUNITY, label: '커뮤니티' },
] as const;

const QUICK_LINKS = [
  { href: `${ROUTES.JOBS}?region=seoul`, label: '서울 채용' },
  { href: `${ROUTES.JOBS}?businessType=venue`, label: '예식장' },
  { href: `${ROUTES.JOBS}?businessType=planner`, label: '웨딩플래너' },
  { href: ROUTES.DIRECTORY, label: '업체 찾기' },
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
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
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

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="hidden md:block bg-secondary-50 border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8 h-9 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-gray-500">
            <Link href={ROUTES.JOBS_NEW} className="hover:text-primary transition-colors">공고 등록</Link>
            <Link href={ROUTES.DIRECTORY_REGISTER} className="hover:text-primary transition-colors">업체 등록</Link>
            <Link href="/contact" className="hover:text-primary transition-colors">고객센터</Link>
          </div>
          <div className="flex items-center gap-3 text-gray-500">
            {isAuthenticated ? (
              <>
                <Link href={ROUTES.MYPAGE} className="hover:text-primary transition-colors">마이페이지</Link>
                <Link href={ROUTES.MYPAGE_NOTIFICATIONS} className="hover:text-primary transition-colors">알림</Link>
                {profile.role === 'admin' && (
                  <Link href={ROUTES.ADMIN} className="hover:text-primary transition-colors">관리자</Link>
                )}
              </>
            ) : (
              <>
                <Link href={ROUTES.LOGIN} className="hover:text-primary transition-colors">로그인</Link>
                <span className="w-px h-3 bg-gray-200" />
                <Link href={ROUTES.SIGNUP} className="hover:text-primary transition-colors">회원가입</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8">
        <div className="h-[74px] flex items-center gap-5">
          <Link href={ROUTES.HOME} className="shrink-0" aria-label="Marié 홈">
            <Logo variant="full" size="md" />
          </Link>

          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-[560px]">
            <div className="flex h-12 w-full items-center overflow-hidden rounded border-2 border-primary bg-white">
              <div className="pl-4 text-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="직무, 업체명, 지역으로 검색"
                className="min-w-0 flex-1 px-3 text-[15px] outline-none placeholder:text-gray-400"
              />
              <button type="submit" className="h-full px-5 bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors">
                검색
              </button>
            </div>
          </form>

          <div className="hidden lg:flex items-center gap-2 ml-auto">
            <Link href={ROUTES.JOBS_NEW} className="btn-outline px-4 py-2 text-xs">채용공고 등록</Link>
            <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary px-4 py-2 text-xs">글쓰기</Link>
          </div>

          {isAuthenticated && (
            <div className="hidden md:block relative ml-auto lg:ml-0">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2.5 py-2 hover:border-primary-300 transition-colors"
              >
                {profile.profile_image ? (
                  <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`} alt="" className="w-7 h-7 rounded object-cover" />
                ) : (
                  <span className="w-7 h-7 rounded bg-primary-50 text-primary flex items-center justify-center text-xs font-bold">
                    {profile.contact_name?.charAt(0) || '?'}
                  </span>
                )}
                <span className="max-w-[88px] truncate text-sm font-semibold text-gray-700">{profile.contact_name || '내 정보'}</span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 shadow-lg z-20 rounded overflow-hidden">
                    <Link
                      href={ROUTES.MYPAGE}
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-4 hover:bg-primary-50/60 transition-colors"
                    >
                      {profile.profile_image ? (
                        <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <span className="w-10 h-10 rounded bg-primary-50 text-primary flex items-center justify-center font-bold shrink-0">
                          {profile.contact_name?.charAt(0) || '?'}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{profile.company_name || profile.contact_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{profile.account_type === 'business' ? '기업회원' : '개인회원'}</p>
                      </div>
                    </Link>
                    <div className="border-t border-gray-100 py-1">
                      <MenuLink href={ROUTES.MYPAGE_EDIT} onClick={() => setProfileMenuOpen(false)} label="프로필 관리" />
                      <MenuLink href={ROUTES.MYPAGE_NOTIFICATIONS} onClick={() => setProfileMenuOpen(false)} label="알림" />
                      <MenuLink href={ROUTES.MYPAGE_PASSWORD} onClick={() => setProfileMenuOpen(false)} label="비밀번호 변경" />
                      {profile.role === 'admin' && (
                        <MenuLink href={ROUTES.ADMIN} onClick={() => setProfileMenuOpen(false)} label="관리자 패널" />
                      )}
                    </div>
                    <div className="border-t border-gray-100 p-2">
                      <button
                        onClick={signOut}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 rounded hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        로그아웃
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden ml-auto w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-gray-700"
            aria-label="메뉴 열기"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>

        <nav className="hidden md:flex h-12 items-center gap-1 border-t border-gray-100">
          <Link href={ROUTES.JOBS} className="mr-2 inline-flex h-8 items-center gap-1.5 rounded bg-gray-900 px-3 text-sm font-bold text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            전체메뉴
          </Link>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`relative px-3.5 py-3 text-[15px] font-bold transition-colors ${
                isActive(link.href) ? 'text-primary' : 'text-gray-800 hover:text-primary'
              }`}
            >
              {link.label}
              {isActive(link.href) && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-primary" />}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            {QUICK_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-primary transition-colors">{link.label}</Link>
            ))}
          </div>
        </nav>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-4 py-3">
            <form onSubmit={handleSearch}>
              <div className="flex h-11 overflow-hidden rounded border-2 border-primary bg-white">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="직무, 업체명, 지역 검색"
                  className="min-w-0 flex-1 px-3 text-sm outline-none"
                />
                <button type="submit" className="px-4 bg-primary text-white font-bold text-sm">검색</button>
              </div>
            </form>
          </div>
          <nav className="grid grid-cols-2 gap-1 px-4 pb-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-3 rounded border text-sm font-bold ${
                  isActive(link.href) ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-700'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-gray-100 px-4 py-3">
            {isAuthenticated ? (
              <div className="grid grid-cols-2 gap-2">
                <Link href={ROUTES.MYPAGE} onClick={() => setMobileMenuOpen(false)} className="btn-secondary text-sm">마이페이지</Link>
                <button onClick={signOut} className="btn-outline text-sm">로그아웃</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href={ROUTES.LOGIN} onClick={() => setMobileMenuOpen(false)} className="btn-secondary text-sm">로그인</Link>
                <Link href={ROUTES.SIGNUP} onClick={() => setMobileMenuOpen(false)} className="btn-primary text-sm">회원가입</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function MenuLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50/70 hover:text-primary transition-colors"
    >
      {label}
    </Link>
  );
}
