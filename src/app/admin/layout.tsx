'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/shared/hooks/useAuth';
import Logo from '@/shared/components/Logo';

const NAV_ITEMS = [
  { href: ROUTES.ADMIN, label: '대시보드', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: ROUTES.ADMIN_USERS, label: '회원 관리', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.053M18 6.75a3 3 0 11-6 0 3 3 0 016 0zM6.75 9.75a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: ROUTES.ADMIN_JOBS, label: '공고 관리', icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0' },
  { href: ROUTES.ADMIN_POSTS, label: '게시글 관리', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { href: ROUTES.ADMIN_COMMENTS, label: '댓글 관리', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
  { href: ROUTES.ADMIN_REPORTS, label: '신고 관리', icon: 'M12 9v3.75m0 3.75h.008v.008H12v-.008zM3.4 19.5h17.2c1.54 0 2.5-1.667 1.73-3L13.73 2.25c-.77-1.333-2.69-1.333-3.46 0L1.67 16.5c-.77 1.333.192 3 1.73 3z' },
  { href: ROUTES.ADMIN_VERIFICATIONS, label: '인증 심사', icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z' },
  { href: ROUTES.ADMIN_AUDIT_LOG, label: '감사 로그', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
  { href: ROUTES.ADMIN_BANNERS, label: '배너 관리', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
  { href: ROUTES.ADMIN_MODERATION_KEYWORDS, label: '모더레이션 키워드', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
  { href: ROUTES.ADMIN_EVENTS, label: '이벤트 관리', icon: 'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 인증/권한 가드는 middleware가 담당 (src/lib/supabase/middleware.ts):
  //   - 비로그인 → /login (redirect param 포함)
  //   - role !== 'admin' → 홈으로
  // 여기까지 도달하면 항상 admin 권한이 보장됨.

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-sidebar bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -ml-2 text-gray-600" aria-label="메뉴 열기">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <Logo variant="full" size="sm" />
          <span className="text-[11px] font-bold bg-primary text-white px-1.5 py-0.5 rounded">ADMIN</span>
        </div>
        <Link href={ROUTES.HOME} className="text-sm text-gray-500 hover:text-gray-800">사이트로</Link>
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-overlay lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}

      {/* Sidebar */}
      <aside
        style={{ width: 'var(--sidebar-w)' }}
        className={`fixed top-0 left-0 z-sidebar h-full bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-14 flex items-center gap-2 px-6 border-b border-gray-100">
          <Link href={ROUTES.ADMIN} aria-label="Marié Admin 홈">
            <Logo variant="full" size="sm" />
          </Link>
          <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded">ADMIN</span>
        </div>
        <nav className="p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm font-bold transition-colors ${
                isActive(item.href)
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <Link
            href={ROUTES.HOME}
            className="flex items-center justify-center gap-2 w-full rounded bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
            사이트로 돌아가기
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-[var(--sidebar-w)]">
        <div className="p-4 lg:p-8 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
