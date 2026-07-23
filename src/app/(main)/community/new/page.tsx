import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import PostForm from '@/features/community/components/PostForm';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '새 글 작성',
};

export default async function NewPostPage() {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) {
    redirect(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.COMMUNITY_NEW)}`);
  }

  return (
    <div className="max-w-[860px] mx-auto space-y-4">
      <div className="saramin-section p-5">
        <Link
          href={ROUTES.COMMUNITY}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          목록으로
        </Link>
        <p className="text-sm font-bold text-primary">커뮤니티</p>
        <h1 className="text-2xl font-bold text-gray-900">새 글 작성</h1>
      </div>

      <div className="bg-white border-y border-gray-200 p-5">
        <PostForm profileId={viewer.profileId} />
      </div>
    </div>
  );
}
