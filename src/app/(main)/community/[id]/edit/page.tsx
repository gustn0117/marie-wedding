import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import type { Post } from '@/types/database';
import PostForm from '@/features/community/components/PostForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getPost(id: string): Promise<Post | null> {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  return data as Post | null;
}

export default async function EditPostPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');

  if (!profileCookie?.value) {
    redirect(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.COMMUNITY_EDIT(params.id))}`);
  }

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const post = await getPost(params.id);
  if (!post) notFound();

  if (me.id !== post.author_id) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">수정 권한이 없습니다</h2>
        <Link href={ROUTES.COMMUNITY_DETAIL(params.id)} className="btn-primary text-sm">돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href={ROUTES.COMMUNITY_DETAIL(params.id)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">글 수정</h1>
      </div>

      <div className="bg-white border border-gray-200 p-6">
        <PostForm
          initialData={{ title: post.title, content: post.content, category: post.category }}
          postId={params.id}
          profileId={me.id}
        />
      </div>
    </div>
  );
}
