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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href={ROUTES.COMMUNITY}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          목록으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">새 글 작성</h1>
      </div>

      <div className="bg-white border border-gray-200 p-6">
        <PostForm profileId={profile.id} />
      </div>
    </div>
  );
}
