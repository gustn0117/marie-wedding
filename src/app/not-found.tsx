import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <Link href={ROUTES.HOME} className="text-3xl font-bold tracking-tight text-ink mb-8" aria-label="Marié 홈">
        Marié
      </Link>
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-ink mb-2">페이지를 찾을 수 없어요</h1>
      <p className="text-sm text-gray-500 leading-relaxed mb-8">
        삭제되었거나 존재하지 않는 페이지예요.<br />
        주소가 바뀌었거나 게시물이 내려갔을 수 있어요.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href={ROUTES.HOME} className="btn-primary px-6 py-2.5 text-sm">홈으로</Link>
        <Link href={ROUTES.JOBS} className="rounded border border-gray-300 px-6 py-2.5 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition-colors">
          채용 공고 보기
        </Link>
      </div>
    </div>
  );
}
