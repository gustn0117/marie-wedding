'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import LoginModal from './LoginModal';
import LoginForm from './LoginForm';
import {
  OPEN_LOGIN_MODAL_EVENT,
  markLoginModalClick,
  openLoginModal,
  type OpenLoginModalDetail,
} from '@/shared/utils/loginModal';

/**
 * PC 로그인 창 — 루트 레이아웃에 한 번 둔다.
 * 1) 사이트 안 /login 링크 클릭을 캡처 단계에서 가로채 페이지 이동 대신 창을 띄운다
 *    (preventDefault 된 클릭은 Next Link 가 이동하지 않는다. Link 의 onClick 은 그대로 돈다).
 * 2) 코드에서 openLoginModal(redirect) 로도 연다(북마크·좋아요·쪽지 버튼).
 * 서버에 다녀오지 않으므로 바로 뜨고 보던 스크롤 위치도 그대로다.
 * 휴대폰 폭·인증 화면은 가로채지 않아 로그인 페이지로 간다(openLoginModal 이 false).
 */
export default function LoginModalHost() {
  const [redirect, setRedirect] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenLoginModalDetail>).detail;
      setRedirect(detail?.redirect || window.location.pathname + window.location.search);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== '/login') return;
      if (!openLoginModal(url.searchParams.get('redirect') ?? undefined)) return;
      e.preventDefault();
      markLoginModalClick(e);
    };
    window.addEventListener(OPEN_LOGIN_MODAL_EVENT, onOpen);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener(OPEN_LOGIN_MODAL_EVENT, onOpen);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  // 창 안의 '회원가입'·'비밀번호 찾기'로 다른 페이지에 가면 창을 닫는다.
  const lastPathRef = useRef(pathname);
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    setRedirect(null);
  }, [pathname]);

  if (redirect === null) return null;
  return (
    <LoginModal onClose={() => setRedirect(null)}>
      <LoginForm variant="modal" redirect={redirect} />
    </LoginModal>
  );
}
