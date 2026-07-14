'use client';

import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

const SERVICE_LINKS = [
  { href: ROUTES.JOBS, label: '채용정보' },
  { href: ROUTES.DIRECTORY, label: '인재·업체 프로필' },
  { href: ROUTES.COMMUNITY, label: '커뮤니티' },
] as const;

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white text-gray-600">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8 py-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-gray-100 pb-4 text-sm font-semibold text-gray-700">
          {SERVICE_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="hover:text-primary transition-colors">
              {link.label}
            </Link>
          ))}
          <a
            href="https://haramevent.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            웨딩 컨시어지(예식도우미)
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
          <Link href="/terms" className="hover:text-primary transition-colors">이용약관</Link>
          <Link href="/privacy" className="text-gray-900 hover:text-primary transition-colors">개인정보처리방침</Link>
          <Link href="/contact" className="hover:text-primary transition-colors">고객센터</Link>
        </div>

        <div className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="max-w-3xl text-xs leading-relaxed text-gray-500">
              마리에는 웨딩 업계 종사자와 업체를 위한 구인구직, 프로필 탐색, 커뮤니티 플랫폼입니다.
              서비스 이용 문의는 고객센터를 통해 접수해주세요.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs md:text-right">
            <Link href={ROUTES.JOBS_NEW} className="rounded border border-gray-200 px-3 py-2 font-semibold hover:border-primary hover:text-primary transition-colors">
              공고 등록
            </Link>
            <Link href={ROUTES.DIRECTORY_REGISTER} className="rounded border border-gray-200 px-3 py-2 font-semibold hover:border-primary hover:text-primary transition-colors">
              프로필 등록
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Marié. All rights reserved.</p>
          <p>Wedding jobs and community platform</p>
        </div>
      </div>
    </footer>
  );
}
