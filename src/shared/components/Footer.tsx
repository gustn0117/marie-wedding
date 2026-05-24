'use client';

import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

const SERVICE_LINKS = [
  { href: ROUTES.JOBS, label: '채용정보' },
  { href: `${ROUTES.JOBS}?type=matching`, label: '파트너 섭외' },
  { href: ROUTES.DIRECTORY, label: '업체정보' },
  { href: ROUTES.COMMUNITY, label: '커뮤니티' },
  { href: ROUTES.EVENTS, label: '이벤트' },
] as const;

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white text-gray-600">
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-gray-100 pb-4 text-sm font-semibold text-gray-700">
          {SERVICE_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="hover:text-primary transition-colors">
              {link.label}
            </Link>
          ))}
          <Link href="/terms" className="hover:text-primary transition-colors">이용약관</Link>
          <Link href="/privacy" className="text-gray-900 hover:text-primary transition-colors">개인정보처리방침</Link>
          <Link href="/contact" className="hover:text-primary transition-colors">고객센터</Link>
        </div>

        <div className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-white text-sm font-black">M</span>
              <span className="text-xl font-black tracking-tight text-primary">Marié</span>
            </div>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-gray-500">
              마리에는 웨딩 업계 종사자와 업체를 위한 채용, 파트너 섭외, 업체 디렉토리, 커뮤니티 플랫폼입니다.
              서비스 이용 문의와 광고 제휴 문의는 고객센터를 통해 접수해주세요.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs md:text-right">
            <Link href={ROUTES.JOBS_NEW} className="rounded border border-gray-200 px-3 py-2 font-semibold hover:border-primary hover:text-primary transition-colors">
              공고 등록
            </Link>
            <Link href={ROUTES.DIRECTORY_REGISTER} className="rounded border border-gray-200 px-3 py-2 font-semibold hover:border-primary hover:text-primary transition-colors">
              업체 등록
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Marié. All rights reserved.</p>
          <p>Wedding business network service</p>
        </div>
      </div>
    </footer>
  );
}
