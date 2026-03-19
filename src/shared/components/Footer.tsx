'use client';

import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-300 mt-auto">
      <div className="max-w-[1200px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <span className="font-serif text-2xl font-bold text-white tracking-wide">Marié</span>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              웨딩 업계 종사자를 위한<br />
              B2B 네트워크 플랫폼
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">서비스</h3>
            <ul className="space-y-2">
              <li><Link href={ROUTES.JOBS} className="text-sm text-gray-400 hover:text-white transition-colors">채용정보</Link></li>
              <li><Link href={ROUTES.DIRECTORY} className="text-sm text-gray-400 hover:text-white transition-colors">업체정보</Link></li>
              <li><Link href={ROUTES.COMMUNITY} className="text-sm text-gray-400 hover:text-white transition-colors">커뮤니티</Link></li>
              <li><Link href={ROUTES.EVENTS} className="text-sm text-gray-400 hover:text-white transition-colors">이벤트</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">고객지원</h3>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-sm text-gray-400 hover:text-white transition-colors">이용약관</Link></li>
              <li><Link href="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">개인정보처리방침</Link></li>
              <li><Link href="/contact" className="text-sm text-gray-400 hover:text-white transition-colors">고객센터</Link></li>
              <li><Link href="/contact" className="text-sm text-gray-400 hover:text-white transition-colors">광고/제휴 문의</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">기업서비스</h3>
            <ul className="space-y-2">
              <li><Link href={ROUTES.JOBS_NEW} className="text-sm text-gray-400 hover:text-white transition-colors">공고 등록</Link></li>
              <li><Link href={ROUTES.DIRECTORY} className="text-sm text-gray-400 hover:text-white transition-colors">인재 검색</Link></li>
              <li><Link href={ROUTES.MYPAGE_EDIT} className="text-sm text-gray-400 hover:text-white transition-colors">기업 프로필 관리</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-700">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} Marié. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <Link href="/terms" className="hover:text-gray-300 transition-colors">이용약관</Link>
            <Link href="/privacy" className="font-semibold text-gray-400 hover:text-gray-300 transition-colors">개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
