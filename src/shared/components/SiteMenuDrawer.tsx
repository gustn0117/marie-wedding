'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { RECOMMENDED_LINKS, SITE_MENU, type SiteMenuLink, type SiteMenuSection } from '@/shared/constants/siteMenu';
import { buildMenuSearchIndex, searchMenu, type MenuSearchEntry } from '@/shared/utils/menuSearch';
import { loginHref } from '@/shared/utils/loginRedirect';
import type { AuthProfile } from './Header';

export const SITE_MENU_DRAWER_ID = 'site-menu-drawer';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SEARCH_RESULTS_ID = 'site-menu-search-results';

// 비로그인일 때 드로어 상단의 로그인·회원가입도 메뉴 검색에 걸리게 한다.
function accountEntries(pathname: string): MenuSearchEntry[] {
  return [
    { label: '로그인', path: ['계정'], href: loginHref(pathname) },
    { label: '회원가입', path: ['계정'], href: ROUTES.SIGNUP },
  ];
}

function myPageSection(profile: AuthProfile): SiteMenuSection {
  const links: SiteMenuLink[] = [{ label: '마이페이지 홈', href: ROUTES.MYPAGE }];
  if (profile.account_type === 'business') links.push({ label: '대시보드', href: ROUTES.MYPAGE_DASHBOARD });
  if (profile.account_type === 'individual') links.push({ label: '이력서 관리', href: ROUTES.MYPAGE_RESUMES });
  links.push(
    { label: '프로필 관리', href: ROUTES.MYPAGE_EDIT },
    { label: '북마크', href: ROUTES.MYPAGE_BOOKMARKS },
    { label: '알림', href: ROUTES.MYPAGE_NOTIFICATIONS },
    { label: '쪽지', href: ROUTES.MYPAGE_MESSAGES },
  );
  if (profile.role === 'admin') links.push({ label: '관리자 패널', href: ROUTES.ADMIN });
  return { id: 'mypage', label: '마이페이지', href: ROUTES.MYPAGE, links };
}

function sectionMatches(section: SiteMenuSection, pathname: string) {
  return !section.external && (pathname === section.href || pathname.startsWith(`${section.href}/`));
}

/**
 * 전체 메뉴 드로어 — 헤더의 '메뉴·검색' 버튼으로 오른쪽에서 열린다.
 * 상단: 계정 · 닫기 · 메뉴 검색 · 추천 / 하단: 좌측 대분류(스크롤 위치 따라 강조) + 우측 전체 하위 메뉴.
 * 검색창은 메뉴 검색 — 입력하면 하단이 일치하는 메뉴 목록으로 바뀐다. 메뉴에 없는 말(업체명 등)은
 * 공고·프로필·글 검색(/search)으로 넘긴다.
 * body scroll lock, ESC, 배경 클릭, 포커스 가두기, 라우트 변경 시 자동 닫힘.
 * 닫혀 있어도 DOM 에 남겨 두고 visibility 로 숨긴다 — 여닫는 슬라이드 전환을 위해.
 */
export default function SiteMenuDrawer({
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
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(SITE_MENU[0].id);
  const [expanded, setExpanded] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const spyLockUntilRef = useRef(0);
  const spyFrameRef = useRef(0);

  // 마이페이지는 커뮤니티 다음 — 로그인 사용자가 가장 자주 여는 곳
  const sections = useMemo(() => {
    if (!profile) return SITE_MENU;
    const at = SITE_MENU.findIndex((s) => s.id === 'community') + 1;
    return [...SITE_MENU.slice(0, at), myPageSection(profile), ...SITE_MENU.slice(at)];
  }, [profile]);

  const menuIndex = useMemo(
    () => buildMenuSearchIndex(sections, profile ? [] : accountEntries(pathname)),
    [sections, profile, pathname],
  );
  const trimmedQuery = query.trim();
  const results = useMemo(() => searchMenu(menuIndex, trimmedQuery), [menuIndex, trimmedQuery]);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 닫힐 때 검색어를 비운다 — 다음에 열면 전체 메뉴부터 보이게.
  useEffect(() => {
    if (!open) return;
    return () => setQuery('');
  }, [open]);

  // body scroll lock (iOS 호환) — 스크롤바가 사라지며 본문이 옆으로 밀리지 않게 폭만큼 채운다.
  useEffect(() => {
    if (!open) return;
    const y = window.scrollY;
    const body = document.body;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      body.style.paddingRight = '';
      // html 에 scroll-behavior:smooth 가 걸려 있어 기본값이면 맨 위에서 굴러 내려온다.
      window.scrollTo({ top: y, behavior: 'instant' });
    };
  }, [open]);

  // ESC 닫기 + 포커스를 드로어 안에 가둔다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!panel.contains(current)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 열릴 때: 마우스 환경은 검색창, 터치 환경은 닫기 버튼에 포커스(키보드가 바로 뜨지 않게).
  // 닫힐 때: 드로어를 연 버튼으로 포커스를 돌려준다.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const timer = window.setTimeout(() => (finePointer ? searchRef.current : closeRef.current)?.focus(), 60);
    return () => {
      window.clearTimeout(timer);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);

  // 열릴 때 지금 보고 있는 페이지의 분류부터 보여준다
  useEffect(() => {
    if (!open) return;
    const id = sections.find((s) => sectionMatches(s, pathname))?.id ?? sections[0].id;
    setActiveId(id);
    const box = scrollRef.current;
    const el = sectionRefs.current.get(id);
    if (box && el) {
      // 뒤쪽 분류는 맨 아래에서 멈춰 스크롤 감지가 마지막 분류로 바꿔 버리므로 잠시 잠근다
      spyLockUntilRef.current = Date.now() + 300;
      box.scrollTop = el.offsetTop - parseFloat(getComputedStyle(box).paddingTop);
    }
    // 여는 순간 한 번만 맞춘다 — 열린 뒤 사용자가 움직인 위치는 건드리지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 라우트가 바뀌면 닫는다 (링크 클릭 외 뒤로가기 등)
  const lastPathRef = useRef(pathname);
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    if (open) onClose();
  }, [pathname, open, onClose]);

  useEffect(() => () => cancelAnimationFrame(spyFrameRef.current), []);

  // 우측 목록 스크롤 위치에 맞춰 좌측 대분류 강조
  const syncActiveToScroll = useCallback(() => {
    const box = scrollRef.current;
    if (!box || Date.now() < spyLockUntilRef.current) return;
    const padTop = parseFloat(getComputedStyle(box).paddingTop);
    let current = sections[0].id;
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2) {
      // 맨 아래 — 짧은 마지막 분류는 위로 끝까지 올라오지 못하므로 여기서 잡는다
      current = sections[sections.length - 1].id;
    } else {
      for (const s of sections) {
        const el = sectionRefs.current.get(s.id);
        if (el && el.offsetTop - padTop - 8 <= box.scrollTop) current = s.id;
      }
    }
    setActiveId(current);
  }, [sections]);

  const handleScroll = () => {
    cancelAnimationFrame(spyFrameRef.current);
    spyFrameRef.current = requestAnimationFrame(syncActiveToScroll);
  };

  const jumpTo = (id: string) => {
    setActiveId(id);
    const box = scrollRef.current;
    const el = sectionRefs.current.get(id);
    if (!box || !el) return;
    // 부드럽게 굴러가는 동안 지나치는 분류로 강조가 깜빡이지 않게 잠시 잠근다
    spyLockUntilRef.current = Date.now() + 800;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: el.offsetTop - parseFloat(getComputedStyle(box).paddingTop), behavior: reduce ? 'auto' : 'smooth' });
  };

  const openEntry = (entry: MenuSearchEntry) => {
    if (entry.external) window.open(entry.href, '_blank', 'noopener,noreferrer');
    else router.push(entry.href);
    onClose();
  };

  const searchContent = () => {
    if (!trimmedQuery) return;
    router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    onClose();
  };

  // 엔터: 첫 번째 메뉴로 이동. 메뉴에 없는 말이면 공고·프로필·글 검색으로 넘긴다.
  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmedQuery) {
      searchRef.current?.focus();
      return;
    }
    if (results.length > 0) openEntry(results[0]);
    else searchContent();
  };

  // ↓/↑ 로 검색창과 결과 사이를 오간다
  const moveResultFocus = (dir: 1 | -1) => {
    const items = Array.from(resultsRef.current?.querySelectorAll<HTMLElement>('[data-menu-result]') ?? []);
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at === -1) {
      if (dir === 1) items[0].focus();
      return;
    }
    const next = at + dir;
    if (next < 0) searchRef.current?.focus();
    else items[Math.min(next, items.length - 1)].focus();
  };

  const displayName = profile?.company_name || profile?.contact_name || '';
  const avatarUrl = profile?.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  return (
    <>
      {/* 어두운 배경 */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-overlay bg-black/60 transition-[opacity,visibility] duration-300 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      />

      <div
        ref={panelRef}
        id={SITE_MENU_DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-label="전체 메뉴"
        className={`fixed inset-y-0 right-0 z-modal flex w-full flex-col bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] sm:w-[560px] lg:w-[600px] ${
          open ? 'visible translate-x-0' : 'invisible translate-x-full'
        }`}
      >
        {/* 상단 — 계정 · 닫기 · 검색 · 추천 */}
        <div className="shrink-0 bg-primary text-white [&_a:focus-visible]:outline-white [&_button:focus-visible]:outline-white">
          <div className="flex h-14 items-center justify-between gap-3 border-b border-white/10 pl-5 pr-2 sm:pl-8 sm:pr-4">
            {profile ? (
              <div className="flex min-w-0 items-center gap-2.5">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/20 object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[13px] font-bold">
                    {displayName.charAt(0) || '?'}
                  </span>
                )}
                <span className="min-w-0 truncate text-[14px] font-bold">{displayName}</span>
                <span className="hidden shrink-0 text-[12px] text-white/60 sm:inline">
                  {profile.account_type === 'business' ? '업체 회원' : '개인 회원'}
                </span>
                <button
                  type="button"
                  onClick={() => { onClose(); onSignOut(); }}
                  className="ml-1 inline-flex h-11 shrink-0 items-center px-2 text-[13px] text-white/75 transition-colors hover:text-white"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="-ml-2 flex items-center text-[14px]">
                <Link href={loginHref(pathname)} prefetch={false} onClick={onClose} className="inline-flex h-11 items-center px-2 font-semibold hover:underline underline-offset-4">
                  로그인
                </Link>
                <span aria-hidden className="h-3 w-px bg-white/30" />
                <Link href={ROUTES.SIGNUP} onClick={onClose} className="inline-flex h-11 items-center px-2 text-white/80 hover:text-white hover:underline underline-offset-4">
                  회원가입
                </Link>
              </div>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="메뉴 닫기"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-5 pb-7 pt-7 sm:px-8 sm:pb-9 sm:pt-10">
            <form role="search" onSubmit={handleSearch} className="flex items-center gap-3 border-b-2 border-white/80 pb-3 transition-colors focus-within:border-white">
              <button type="submit" aria-label="메뉴 검색" className="-m-1 shrink-0 p-1 text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' && trimmedQuery) {
                    e.preventDefault();
                    moveResultFocus(1);
                  }
                }}
                placeholder="찾는 메뉴를 입력해 주세요"
                aria-label="메뉴 검색"
                aria-controls={trimmedQuery ? SEARCH_RESULTS_ID : undefined}
                enterKeyHint="search"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[18px] font-medium text-white outline-none placeholder:text-white/70 focus-visible:outline-none sm:text-[21px] [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchRef.current?.focus();
                  }}
                  aria-label="검색어 지우기"
                  className="-my-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </form>
            <p className="sr-only" aria-live="polite">
              {trimmedQuery ? (results.length > 0 ? `메뉴 ${results.length}개` : '일치하는 메뉴가 없습니다') : ''}
            </p>
            <div className="mt-5 flex items-start gap-3">
              <span className="shrink-0 pt-1.5 text-[13px] font-bold text-white/90">추천</span>
              <ul className="flex flex-wrap gap-2">
                {RECOMMENDED_LINKS.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      onClick={onClose}
                      className="inline-flex h-8 items-center rounded-full border border-white/70 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-white hover:text-primary"
                    >
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 하단 — 검색 중이면 메뉴 검색 결과, 아니면 좌: 대분류 / 우: 하위 메뉴 전체 */}
        {trimmedQuery ? (
          <MenuSearchResults
            query={trimmedQuery}
            results={results}
            listRef={resultsRef}
            onNavigate={onClose}
            onSearchContent={searchContent}
            onMoveFocus={moveResultFocus}
          />
        ) : (
        <div className="flex min-h-0 flex-1">
          <nav aria-label="메뉴 분류" className="w-[34%] shrink-0 overflow-y-auto bg-gray-50 px-4 py-5 sm:px-8 sm:py-7">
            <ul>
              {sections.map((s) => {
                const on = activeId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => jumpTo(s.id)}
                      aria-current={on ? 'true' : undefined}
                      className={`block w-full break-keep py-3 text-left text-[15px] transition-colors sm:text-[17px] ${
                        on ? 'font-bold text-primary' : 'font-medium text-gray-500 hover:text-ink'
                      }`}
                    >
                      <span className={on ? 'border-b-2 border-primary pb-0.5' : ''}>{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7"
          >
            {sections.map((s) => (
              <section
                key={s.id}
                ref={(el) => {
                  if (el) sectionRefs.current.set(s.id, el);
                  else sectionRefs.current.delete(s.id);
                }}
                aria-labelledby={`site-menu-${s.id}`}
                className="mb-9 last:mb-0"
              >
                <h3 id={`site-menu-${s.id}`} className="border-b border-gray-200 pb-3 pt-3 text-[16px] font-bold text-ink sm:text-[18px]">
                  {s.label}
                </h3>
                <ul className="mt-2">
                  {s.links.map((link) => {
                    const key = `${s.id}:${link.label}`;
                    return (
                      <MenuLinkRow
                        key={key}
                        link={link}
                        pathname={pathname}
                        expanded={expanded === key}
                        onToggle={() => setExpanded((cur) => (cur === key ? null : key))}
                        onNavigate={onClose}
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
        )}
      </div>
    </>
  );
}

/** 검색어와 겹치는 부분을 강조한다(가장 긴 단어부터, 첫 일치 한 곳). */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const lower = text.toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    const at = lower.indexOf(token.toLowerCase());
    if (at >= 0) {
      return (
        <>
          {text.slice(0, at)}
          <mark className="bg-transparent text-primary">{text.slice(at, at + token.length)}</mark>
          {text.slice(at + token.length)}
        </>
      );
    }
  }
  return <>{text}</>;
}

function MenuSearchResults({
  query,
  results,
  listRef,
  onNavigate,
  onSearchContent,
  onMoveFocus,
}: {
  query: string;
  results: MenuSearchEntry[];
  listRef: React.RefObject<HTMLDivElement>;
  onNavigate: () => void;
  onSearchContent: () => void;
  onMoveFocus: (dir: 1 | -1) => void;
}) {
  const rowClass =
    'flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-gray-100 py-3 text-left transition-colors hover:text-primary focus-visible:text-primary';

  return (
    <div
      ref={listRef}
      id={SEARCH_RESULTS_ID}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          onMoveFocus(e.key === 'ArrowDown' ? 1 : -1);
        }
      }}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7"
    >
      {results.length > 0 ? (
        <>
          <p className="pb-3 text-[13px] font-semibold text-gray-500">메뉴 {results.length}개</p>
          <ul className="border-t border-gray-200">
            {results.map((r) => {
              const text = (
                <span className="min-w-0">
                  <span className="block break-keep text-[15px] font-semibold text-ink sm:text-[16px]">
                    <HighlightMatch text={r.label} query={query} />
                  </span>
                  {r.path.length > 0 && (
                    <span className="mt-0.5 block truncate text-[12px] text-gray-500 sm:text-[13px]">{r.path.join(' › ')}</span>
                  )}
                </span>
              );
              return (
                <li key={`${r.label}|${r.href}`}>
                  {r.external ? (
                    <a data-menu-result href={r.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={rowClass}>
                      {text}
                      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  ) : (
                    <Link data-menu-result href={r.href} onClick={onNavigate} className={rowClass}>
                      {text}
                      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="py-10 text-center">
          <p className="break-keep text-[15px] font-bold text-ink">‘{query}’에 맞는 메뉴가 없어요</p>
          <p className="mt-1.5 break-keep text-[14px] text-gray-500">메뉴 이름으로 찾아보시거나, 아래에서 공고·프로필·글을 검색해 보세요.</p>
        </div>
      )}

      {/* 메뉴가 아닌 내용(공고 제목·업체명 등)은 기존 통합 검색으로 */}
      <button
        data-menu-result
        type="button"
        onClick={onSearchContent}
        className="mt-5 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 text-left text-[14px] text-gray-600 transition-colors hover:bg-gray-100 hover:text-ink"
      >
        <span className="min-w-0 truncate">
          공고·프로필·글에서 <strong className="font-bold text-ink">‘{query}’</strong> 찾기
        </span>
        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </button>
    </div>
  );
}

function MenuLinkRow({
  link,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  link: SiteMenuLink;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const rowClass = 'flex w-full items-center justify-between gap-2 py-2.5 text-left text-[14px] transition-colors sm:text-[15px]';

  if (link.children) {
    return (
      <li>
        <button type="button" onClick={onToggle} aria-expanded={expanded} className={`${rowClass} text-gray-600 hover:text-ink`}>
          {link.label}
          <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {expanded && (
          <ul className="mb-2 grid grid-cols-1 border-l-2 border-gray-100 pl-3 sm:grid-cols-2 sm:gap-x-3">
            {link.children.map((c) => (
              <li key={c.href}>
                <Link href={c.href} onClick={onNavigate} className="block py-2 text-[13px] text-gray-500 transition-colors hover:text-ink sm:text-[14px]">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  if (link.external) {
    return (
      <li>
        <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={`${rowClass} text-gray-600 hover:text-ink`}>
          <span className="break-keep">{link.label}</span>
          <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </li>
    );
  }

  const current = link.href === pathname;
  return (
    <li>
      <Link
        href={link.href}
        onClick={onNavigate}
        aria-current={current ? 'page' : undefined}
        className={`${rowClass} ${current ? 'font-semibold text-ink' : 'text-gray-600 hover:text-ink'}`}
      >
        {link.label}
      </Link>
    </li>
  );
}
