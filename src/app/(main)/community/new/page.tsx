import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import PostForm from '@/features/community/components/PostForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '새 글 작성 | Marié',
};

export default async function NewPostPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');

  if (!profileCookie?.value) {
    redirect(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.COMMUNITY_NEW)}`);
  }

  let profile: { id: string } | null = null;
  try {
    profile = JSON.parse(profileCookie.value);
  } catch {
    redirect(ROUTES.LOGIN);
  }

  if (!profile?.id) redirect(ROUTES.LOGIN);

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

      <div className="bg-white border border-gray-200 rounded p-5">
        <PostForm profileId={profile.id} />
      </div>
    </div>
  );
}
