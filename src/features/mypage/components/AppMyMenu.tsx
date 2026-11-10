'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ROUTES } from '@/shared/constants';
import { PARTNER_URL } from '@/shared/constants/siteMenu';
import { toastConfirm } from '@/shared/components/Toast';
import { signOutAndGoHome } from '@/shared/utils/signOut';

interface MenuItem {
  label: string;
  href: string;
  external?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

interface AppMyMenuProps {
  /** activity = 프로필 바로 아래 '나의 활동' 바로가기, settings = 화면 맨 아래 계정·고객지원·로그아웃 */
  section: 'activity' | 'settings';
  accountType: 'business' | 'individual';
  isAdmin?: boolean;
}

/**
 * 앱 '마이' 탭의 메뉴 목록(.app-only) — 아이폰 설정처럼 묶은 줄 목록.
 * 웹의 전체 메뉴 서랍·바닥글·마이페이지 칩에 흩어져 있던 곳(고객센터·약관·쪽지·알림 등)을 여기서 모두 연다.
 */
export default function AppMyMenu({ section, accountType, isAdmin = false }: AppMyMenuProps) {
  const isBusiness = accountType === 'business';
  const [signingOut, setSigningOut] = useState(false);

  const groups: MenuGroup[] =
    section === 'activity'
      ? [
          {
            title: '나의 활동',
            items: [
              ...(isBusiness
                ? [
                    { label: '공고 등록', href: ROUTES.JOBS_NEW },
                    { label: '공고 성과', href: ROUTES.MYPAGE_DASHBOARD },
                    { label: '공개 프로필 관리', href: ROUTES.DIRECTORY_REGISTER },
                  ]
                : [{ label: '이력서 관리', href: ROUTES.MYPAGE_RESUMES }]),
              { label: '스크랩한 공고', href: ROUTES.MYPAGE_BOOKMARKS },
              { label: '쪽지', href: ROUTES.MYPAGE_MESSAGES },
              { label: '알림', href: ROUTES.MYPAGE_NOTIFICATIONS },
            ],
          },
        ]
      : [
          {
            title: '계정',
            items: [
              { label: '프로필 수정', href: ROUTES.MYPAGE_EDIT },
              { label: '비밀번호 변경', href: ROUTES.MYPAGE_PASSWORD },
              { label: '차단한 사용자', href: ROUTES.MYPAGE_BLOCKS },
              ...(isBusiness ? [] : [{ label: '업체 회원으로 전환', href: ROUTES.MYPAGE_ACCOUNT_TYPE }]),
              ...(isAdmin ? [{ label: '관리자 패널', href: ROUTES.ADMIN }] : []),
            ],
          },
          {
            title: '고객지원',
            items: [
              { label: '고객센터', href: ROUTES.CONTACT },
              { label: '채용 가이드', href: '/guide' },
              { label: '서비스 소개', href: '/about' },
              { label: '이용약관', href: '/terms' },
              { label: '개인정보처리방침', href: '/privacy' },
              { label: '웨딩 컨시어지(예식도우미)', href: PARTNER_URL, external: true },
            ],
          },
        ];

  const handleSignOut = async () => {
    if (signingOut) return;
    if (!(await toastConfirm('로그아웃할까요?'))) return;
    setSigningOut(true);
    await signOutAndGoHome();
  };

  return (
    // !mt-0: 바로 위 칸(프로필 카드 등)에 회색 띠가 맞붙게 — 부모의 space-y 간격을 지운다
    <div className="app-only app-bleed !mt-0">
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <div aria-hidden className="h-2 bg-gray-100" />
          <h2 className="px-4 pb-1 pt-4 text-[13px] font-semibold text-gray-500">{group.title}</h2>
          <ul className="pb-2">
            {group.items.map((item) => (
              <li key={item.label}>
                <MenuRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {section === 'settings' && (
        <>
          <div aria-hidden className="h-2 bg-gray-100" />
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="h-11 text-[16px] font-semibold text-ink disabled:opacity-50"
            >
              {signingOut ? '로그아웃 중…' : '로그아웃'}
            </button>
            <Link href="/mypage/withdraw" className="flex h-11 items-center text-[13px] text-gray-400">
              회원 탈퇴
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  const className = 'flex h-[52px] items-center justify-between gap-3 px-4 text-[16px] text-ink';
  const body = (
    <>
      <span className="truncate">{item.label}</span>
      <svg className="h-4 w-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor" aria-hidden>
        {item.external ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        )}
      </svg>
    </>
  );
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {body}
    </Link>
  );
}
