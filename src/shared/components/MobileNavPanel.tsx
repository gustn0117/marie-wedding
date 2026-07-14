'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import type { AuthProfile } from './Header';

/**
 * 모바일 슬라이드 다운 메뉴 — 7층 spec (검색 / 프로필 / 채용 액션 / 둘러보기 / 내 정보 / 파트너십 / 하단 CTA).
 * body scroll lock, ESC, backdrop tap, 라우트 변경 시 자동 닫힘.
 */
export default function MobileNavPanel({
  open,
  onClose,
  profile,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  profile: AuthProfile | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const isAuthenticated = !!profile;
  const isBusiness = profile?.account_type === 'business';
  const isIndividual = profile?.account_type === 'individual';

  // body scroll lock (iOS 호환)
  useEffect(() => {
    if (!open) return;
    const y = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';
    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      window.scrollTo(0, y);
    };
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 라우트 변경 시 자동 닫힘
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // md+ 진입 시 자동 닫힘
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => { if (e.matches && open) onClose(); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [open, onClose]);

  // 첫 포커스 → close 버튼
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => closeBtnRef.current?.focus(), 240);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      onClose();
    }
  };

  if (!open) return null;

  const displayName = profile?.company_name || profile?.contact_name || '';
  const initial = displayName.charAt(0) || '?';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed left-0 right-0 bottom-0 z-overlay bg-black/45 backdrop-blur-[2px] md:hidden animate-fadeIn"
        style={{ top: 'var(--header-h)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        ref={panelRef}
        id="mobile-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="메인 메뉴"
        className="fixed left-0 right-0 z-modal bg-white md:hidden flex flex-col animate-slideDown"
        style={{
          top: 'var(--header-h)',
          maxHeight: 'calc(100dvh - var(--header-h))',
          boxShadow: '0 24px 48px -24px rgba(0,0,0,0.18)',
        }}
      >
        {/* 0. Sticky 검색 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 pt-4 pb-3 z-10">
          <form onSubmit={handleSearch}>
            <label className="flex items-center gap-2 h-12 px-3 rounded-xl border border-gray-200 bg-white focus-within:border-ink transition-colors">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="업체·공고·인재·게시글 검색"
                className="flex-1 bg-transparent border-none outline-none text-[14px] text-ink placeholder:text-gray-400"
                aria-label="검색"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="검색어 지우기" className="text-gray-400 hover:text-ink">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="메뉴 닫기"
                className="text-gray-500 hover:text-ink p-1 ml-1 border-l border-gray-200 pl-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </label>
          </form>
          {/* 추천 칩 */}
          <div className="mt-3 -mx-5 px-5 overflow-x-auto scrollbar-none" style={{ touchAction: 'pan-x' }}>
            <div className="flex gap-2 whitespace-nowrap pb-1">
              {[
                { label: '#웨딩홀', href: `${ROUTES.JOBS}?businessType=venue` },
                { label: '#드레스', href: `${ROUTES.JOBS}?businessType=dress` },
                { label: '#스튜디오', href: `${ROUTES.JOBS}?businessType=studio` },
                { label: '#메이크업', href: `${ROUTES.JOBS}?businessType=makeup` },
                { label: '#플래너', href: `${ROUTES.JOBS}?businessType=planner` },
              ].map((c) => (
                <Link key={c.label} href={c.href} onClick={onClose} className="shrink-0 px-3 h-8 inline-flex items-center rounded-full border border-gray-200 text-[12px] font-semibold text-gray-700 hover:border-ink hover:text-ink">
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* 1. 프로필 카드 / 로그인 CTA */}
          {isAuthenticated ? (
            <Link
              href={isBusiness ? ROUTES.MYPAGE_DASHBOARD : ROUTES.MYPAGE_RESUMES}
              onClick={onClose}
              className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              {profile?.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${supabaseUrl}/storage/v1/object/public/avatars/${profile.profile_image}`} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
              ) : (
                <span className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 border border-gray-200 flex items-center justify-center text-base font-bold text-primary">
                  {initial}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-ink truncate">{displayName}</p>
                <p className="text-[12px] text-gray-500 mt-0.5 truncate">
                  {profile?.account_type === 'business' ? '업체 계정' : '개인 계정'}
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
          ) : (
            <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-2">
              <Link href={ROUTES.LOGIN} onClick={onClose} className="flex items-center justify-center h-12 rounded-xl bg-ink text-white text-[14px] font-bold">
                로그인하고 시작하기
              </Link>
              <Link href={ROUTES.SIGNUP} onClick={onClose} className="flex items-center justify-center h-12 rounded-xl border border-gray-200 text-[14px] font-bold text-ink">
                Marié 회원가입
              </Link>
            </div>
          )}

          {/* 2. 채용 핵심 액션 */}
          <div className="px-5 py-3 border-b border-gray-100 flex flex-col gap-2">
            <Link
              href={isBusiness ? ROUTES.JOBS_NEW : isIndividual ? ROUTES.MYPAGE_RESUMES : ROUTES.JOBS}
              onClick={onClose}
              className="flex items-center justify-between h-14 rounded-xl bg-primary text-white px-4 hover:bg-primary-dark transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <span className="inline-flex w-7 h-7 rounded-full bg-white/15 items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={isIndividual ? 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H6.75A2.25 2.25 0 004.5 4.5v15.75A1.5 1.5 0 006 21.75h12a1.5 1.5 0 001.5-1.5v-6z' : 'M12 4.5v15m7.5-7.5h-15'} /></svg>
                </span>
                <span className="font-bold text-[15px]">{isBusiness ? '공고 등록' : isIndividual ? '이력서 관리' : '채용정보 둘러보기'}</span>
              </span>
              {isBusiness && <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded">무료</span>}
            </Link>
            {isBusiness && (
              <Link href={ROUTES.MYPAGE_DASHBOARD} onClick={onClose} className="row-link">
                <span className="inline-flex items-center gap-3">
                  <RowIcon path="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                  지원 관리
                </span>
                <ChevronRight />
              </Link>
            )}
          </div>

          {/* 3. 둘러보기 */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1 mb-1.5">MARIÉ</p>
            <NavRow href={ROUTES.HOME} label="홈" iconPath="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" pathname={pathname} onClose={onClose} />
            <NavRow href={ROUTES.JOBS} label="채용정보" iconPath="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" pathname={pathname} onClose={onClose} />
            <NavRow href={ROUTES.DIRECTORY} label="인재·업체 프로필" iconPath="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.053M18 6.75a3 3 0 11-6 0 3 3 0 016 0zM6.75 9.75a3 3 0 11-6 0 3 3 0 016 0z" pathname={pathname} onClose={onClose} />
            <NavRow href={ROUTES.COMMUNITY} label="커뮤니티" iconPath="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" pathname={pathname} onClose={onClose} />
            <NavRow href={ROUTES.CONTACT} label="마리에 고객센터" iconPath="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75m0 3h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" pathname={pathname} onClose={onClose} />
          </div>

          {/* 4. 내 정보 (로그인 시) */}
          {isAuthenticated && (
            <div className="px-5 pt-4 pb-2 border-t border-gray-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1 mb-1.5">내 정보</p>
              {isBusiness && <NavRow href={ROUTES.MYPAGE_DASHBOARD} label="대시보드" iconPath="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" pathname={pathname} onClose={onClose} />}
              {isIndividual && (
                <NavRow href={ROUTES.MYPAGE_RESUMES} label="이력서 관리" iconPath="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H6.75A2.25 2.25 0 004.5 4.5v15.75A1.5 1.5 0 006 21.75h12a1.5 1.5 0 001.5-1.5v-6zM9 13.5h6m-6 3.75h6" pathname={pathname} onClose={onClose} />
              )}
              <NavRow href={ROUTES.MYPAGE_BOOKMARKS} label="북마크" iconPath="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" pathname={pathname} onClose={onClose} />
              <NavRow href={ROUTES.MYPAGE_NOTIFICATIONS} label="알림" iconPath="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" pathname={pathname} onClose={onClose} />
              <NavRow href={ROUTES.MYPAGE_MESSAGES} label="쪽지" iconPath="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" pathname={pathname} onClose={onClose} />
              <NavRow href={ROUTES.MYPAGE} label="마이페이지 홈" iconPath="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.053M18 6.75a3 3 0 11-6 0 3 3 0 016 0z" pathname={pathname} onClose={onClose} />
              {profile?.role === 'admin' && (
                <NavRow href={ROUTES.ADMIN} label="관리자 패널" iconPath="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" pathname={pathname} onClose={onClose} />
              )}
            </div>
          )}

          {/* 5. 제휴업체 — 외부 링크 */}
          <div className="px-5 pt-4 pb-3 border-t border-gray-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1 mb-1.5">제휴업체</p>
            <a
              href="https://haramevent.kr"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-bold text-gray-600 hover:bg-primary-50/40"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
              <span className="flex-1">웨딩 컨시어지(예식도우미)</span>
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>

        {/* 6. 하단 sticky 메타·로그아웃 */}
        <div className="sticky bottom-0 border-t border-gray-100 bg-white px-5 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => { onSignOut(); onClose(); }} className="text-[13px] font-semibold text-gray-600 hover:text-rose-600 transition-colors">
                로그아웃
              </button>
              <span className="text-[11px] text-gray-400">Marié</span>
            </div>
          ) : (
            <p className="text-center text-[12px] text-gray-500">
              계정이 있으신가요?{' '}
              <Link href={ROUTES.LOGIN} onClick={onClose} className="text-ink font-bold hover:underline">로그인</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function NavRow({ href, label, iconPath, pathname, onClose }: { href: string; label: string; iconPath: string; pathname: string; onClose: () => void }) {
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClose}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center justify-between h-12 px-3 rounded-lg transition-colors ${
        isActive ? 'bg-primary-50 text-primary' : 'text-gray-700 hover:bg-gray-50 hover:text-ink'
      }`}
    >
      <span className="inline-flex items-center gap-3">
        <RowIcon path={iconPath} active={isActive} />
        <span className={`text-[14px] ${isActive ? 'font-bold' : 'font-semibold'}`}>{label}</span>
      </span>
      <ChevronRight active={isActive} />
    </Link>
  );
}

function RowIcon({ path, active = false }: { path: string; active?: boolean }) {
  return (
    <svg className={`w-5 h-5 shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function ChevronRight({ active = false }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${active ? 'text-primary/60' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

// row-link 클래스를 globals.css에 추가했다고 가정한 경우용 별도 row 스타일은 NavRow 안에 직접 포함했으므로 불필요. 단 채용 액션 섹션의 보조 row만 다음 클래스로 적용:
// .row-link { @apply flex items-center justify-between h-12 px-3 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-ink transition-colors text-[14px] font-semibold; }
