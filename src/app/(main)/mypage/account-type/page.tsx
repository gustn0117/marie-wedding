import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES } from '@/shared/constants';
import ConvertToBusinessClient from './ConvertToBusinessClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '업체 회원 전환' };

/** ?next= 는 내부 경로만 허용 — 외부 URL 로 열리면 오픈 리다이렉트가 된다. */
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

export default async function AccountTypePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(ROUTES.LOGIN);

  const { next } = await searchParams;
  const nextPath = safeNext(next);

  if (viewer.accountType === 'business') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <h1 className="text-lg font-bold text-gray-900">이미 업체 회원입니다</h1>
          <p className="text-sm text-gray-500">공고 등록 등 업체 기능을 바로 사용할 수 있어요.</p>
          <div className="flex justify-center gap-2">
            <Link href={nextPath ?? ROUTES.JOBS_NEW} className="btn-primary text-sm px-6 py-2.5 inline-block">
              {nextPath ? '하던 작업 계속하기' : '공고 등록하기'}
            </Link>
            <Link href={ROUTES.MYPAGE} className="btn-outline text-sm px-6 py-2.5 inline-block">마이페이지</Link>
          </div>
        </div>
      </div>
    );
  }

  return <ConvertToBusinessClient nextPath={nextPath} />;
}
