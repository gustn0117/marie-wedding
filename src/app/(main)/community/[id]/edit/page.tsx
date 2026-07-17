import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES } from '@/shared/constants';
import type { Post } from '@/types/database';
import PostForm from '@/features/community/components/PostForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
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
  const { id } = await params;
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) {
    redirect(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.COMMUNITY_EDIT(id))}`);
  }

  const post = await getPost(id);
  if (!post) notFound();

  if (viewer.profileId !== post.author_id) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-3">수정 권한이 없습니다</h2>
        <Link href={ROUTES.COMMUNITY_DETAIL(id)} className="btn-primary text-sm">돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[860px] mx-auto space-y-4">
      <div className="saramin-section p-5">
        <Link
          href={ROUTES.COMMUNITY_DETAIL(id)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          돌아가기
        </Link>
        <p className="text-sm font-bold text-primary">커뮤니티</p>
        <h1 className="text-2xl font-bold text-gray-900">글 수정</h1>
      </div>

      <div className="bg-white border-y border-gray-200 p-5">
        <PostForm
          initialData={{ title: post.title, content: post.content, category: post.category }}
          postId={id}
          profileId={viewer.profileId}
        />
      </div>
    </div>
  );
}
