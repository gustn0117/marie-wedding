import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getRegionLabel,
  getEmploymentTypeLabel,
  getCategoryLabel,
} from '@/shared/utils/format';
import EmptyState from '@/shared/components/EmptyState';
import PageHeader from '@/shared/components/PageHeader';
import type { Job, Profile, Post } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = { title: '저장한 항목 | Marié' };

type TabKey = 'jobs' | 'profiles' | 'posts';
const TABS: { key: TabKey; label: string; targetType: 'job' | 'profile' | 'post' }[] = [
  { key: 'jobs', label: '공고', targetType: 'job' },
  { key: 'profiles', label: '업체', targetType: 'profile' },
  { key: 'posts', label: '게시글', targetType: 'post' },
];

interface PageProps {
  searchParams: { tab?: TabKey };
}

export default async function BookmarksPage({ searchParams }: PageProps) {
  // 인증 가드
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile')?.value;
  if (!profileCookie) redirect(ROUTES.LOGIN);

  let profileId: string;
  try {
    profileId = JSON.parse(profileCookie).id;
    if (!profileId) throw new Error();
  } catch {
    redirect(ROUTES.LOGIN);
  }

  const activeTab: TabKey = searchParams.tab && TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab : 'jobs';
  const activeMeta = TABS.find((t) => t.key === activeTab)!;

  const supabase = createServerQueryClient();
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('target_id, created_at')
    .eq('profile_id', profileId)
    .eq('target_type', activeMeta.targetType)
    .order('created_at', { ascending: false })
    .limit(50);

  const items = (bookmarks ?? []) as Array<{ target_id: string; created_at: string }>;
  const ids = items.map((b) => b.target_id);
  const order: Record<string, number> = {};
  items.forEach((b, i) => { order[b.target_id] = i; });

  let jobs: Pick<Job, 'id' | 'title' | 'region' | 'employment_type' | 'status' | 'created_at' | 'deadline'>[] = [];
  let profiles: Pick<Profile, 'id' | 'company_name' | 'contact_name' | 'business_type' | 'region' | 'profile_image' | 'verification_status'>[] = [];
  let posts: Pick<Post, 'id' | 'title' | 'category' | 'view_count' | 'like_count' | 'comment_count' | 'created_at'>[] = [];

  if (ids.length > 0) {
    if (activeMeta.targetType === 'job') {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, region, employment_type, status, created_at, deadline')
        .in('id', ids)
        .is('deleted_at', null);
      jobs = (data ?? []).sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99));
    } else if (activeMeta.targetType === 'profile') {
      const { data } = await supabase
        .from('profiles')
        .select('id, company_name, contact_name, business_type, region, profile_image, verification_status')
        .in('id', ids)
        .is('deleted_at', null);
      profiles = (data ?? []).sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99));
    } else {
      const { data } = await supabase
        .from('posts')
        .select('id, title, category, view_count, like_count, comment_count, created_at')
        .in('id', ids)
        .is('deleted_at', null);
      posts = (data ?? []).sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99));
    }
  }

  const isEmpty = activeMeta.targetType === 'job' ? jobs.length === 0
    : activeMeta.targetType === 'profile' ? profiles.length === 0
    : posts.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="저장한 항목" description="관심 있게 저장해 둔 공고·업체·게시글" />

      {/* Tabs */}
      <div role="tablist" aria-label="저장 항목 분류" className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <Link
              key={t.key}
              href={`${ROUTES.MYPAGE_BOOKMARKS}?tab=${t.key}`}
              role="tab"
              aria-selected={isActive}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                isActive ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {isEmpty ? (
        <EmptyState
          title={`저장한 ${activeMeta.label}이 없습니다`}
          description="관심 있는 항목 옆 하트 버튼을 눌러 저장하면 여기서 모아볼 수 있어요."
          actionLabel={
            activeMeta.targetType === 'job' ? '공고 둘러보기'
            : activeMeta.targetType === 'profile' ? '업체 디렉토리 보기'
            : '커뮤니티 보기'
          }
          actionHref={
            activeMeta.targetType === 'job' ? ROUTES.JOBS
            : activeMeta.targetType === 'profile' ? ROUTES.DIRECTORY
            : ROUTES.COMMUNITY
          }
        />
      ) : activeMeta.targetType === 'job' ? (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {jobs.map((job) => {
            const isClosed = job.status === 'closed' || job.status === 'filled';
            return (
              <li key={job.id}>
                <Link
                  href={ROUTES.JOBS_DETAIL(job.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {isClosed && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded">
                          {job.status === 'filled' ? '채용완료' : '마감'}
                        </span>
                      )}
                      <p className="text-sm font-bold text-ink group-hover:text-primary truncate">{job.title}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {getEmploymentTypeLabel(job.employment_type)} · {getRegionLabel(job.region)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(job.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : activeMeta.targetType === 'profile' ? (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {profiles.map((p) => {
            const name = p.company_name || p.contact_name;
            return (
              <li key={p.id}>
                <Link
                  href={ROUTES.DIRECTORY_DETAIL(p.id)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {p.profile_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${p.profile_image}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">{name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink group-hover:text-primary truncate">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{getRegionLabel(p.region)}</p>
                  </div>
                  {p.verification_status === 'verified' && (
                    <span className="text-[10px] font-bold text-primary bg-primary-50 px-1.5 py-0.5 rounded shrink-0 inline-flex items-center gap-0.5"><svg className="w-2.5 h-2.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> 인증</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={ROUTES.COMMUNITY_DETAIL(post.id)}
                className="block px-4 py-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold">
                    {getCategoryLabel(post.category)}
                  </span>
                  <p className="text-sm font-bold text-ink group-hover:text-primary truncate flex-1">{post.title}</p>
                </div>
                <p className="text-xs text-gray-500">
                  조회 {post.view_count.toLocaleString()} · 좋아요 {post.like_count.toLocaleString()} · 댓글 {post.comment_count ?? 0} · {formatRelativeTime(post.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
