import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import {
  getBusinessTypeLabel,
  getRegionLabel,
  getEmploymentTypeLabel,
  formatRelativeTime,
  getCategoryLabel,
} from '@/shared/utils/format';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import type { Job, Post, Profile } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '검색 결과 | Marié',
};

interface PageProps {
  searchParams: Record<string, string | undefined>;
}

async function search(q: string) {
  const supabase = createServerQueryClient();
  const keyword = `%${q}%`;

  const [hiringRes, matchingRes, directoryRes, postsRes] = await Promise.all([
    // 채용 공고
    supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)')
      .is('deleted_at', null)
      .eq('posting_type', 'hiring')
      .or(`title.ilike.${keyword},description.ilike.${keyword}`)
      .order('created_at', { ascending: false })
      .range(0, 4),
    // 업체 섭외
    supabase
      .from('jobs')
      .select('*, author:profiles!author_id(*)')
      .is('deleted_at', null)
      .eq('posting_type', 'matching')
      .or(`title.ilike.${keyword},description.ilike.${keyword}`)
      .order('created_at', { ascending: false })
      .range(0, 4),
    // 디렉토리
    supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .eq('is_directory_listed', true)
      .or(`company_name.ilike.${keyword},contact_name.ilike.${keyword},bio.ilike.${keyword}`)
      .order('company_name', { ascending: true })
      .range(0, 4),
    // 커뮤니티
    supabase
      .from('posts')
      .select('*, author:profiles!author_id(*)')
      .is('deleted_at', null)
      .or(`title.ilike.${keyword},content.ilike.${keyword}`)
      .order('created_at', { ascending: false })
      .range(0, 4),
  ]);

  return {
    hiring: (hiringRes.data ?? []) as Job[],
    matching: (matchingRes.data ?? []) as Job[],
    directory: (directoryRes.data ?? []) as Profile[],
    posts: (postsRes.data ?? []) as Post[],
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const q = searchParams.q?.trim() || '';

  if (!q) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">검색</h1>
        <p className="text-sm text-gray-500">검색어를 입력해주세요.</p>
      </div>
    );
  }

  const results = await search(q);
  const totalCount = results.hiring.length + results.matching.length + results.directory.length + results.posts.length;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          &ldquo;{q}&rdquo; 검색 결과
        </h1>
        <p className="text-sm text-gray-500 mt-1">총 {totalCount}건</p>
      </div>

      {totalCount === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-gray-500">검색 결과가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">다른 키워드로 검색해보세요.</p>
        </div>
      )}

      {/* 채용 */}
      {results.hiring.length > 0 && (
        <Section title="채용" count={results.hiring.length} moreHref={`${ROUTES.JOBS}?type=hiring&search=${encodeURIComponent(q)}`}>
          {results.hiring.map((job) => (
            <JobItem key={job.id} job={job} />
          ))}
        </Section>
      )}

      {/* 업체 섭외 */}
      {results.matching.length > 0 && (
        <Section title="업체 섭외" count={results.matching.length} moreHref={`${ROUTES.JOBS}?type=matching&search=${encodeURIComponent(q)}`}>
          {results.matching.map((job) => (
            <JobItem key={job.id} job={job} />
          ))}
        </Section>
      )}

      {/* 디렉토리 */}
      {results.directory.length > 0 && (
        <Section title="디렉토리" count={results.directory.length} moreHref={`${ROUTES.DIRECTORY}?search=${encodeURIComponent(q)}`}>
          {results.directory.map((profile) => (
            <Link
              key={profile.id}
              href={ROUTES.DIRECTORY_DETAIL(profile.id)}
              className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <ProfileAvatar profileImage={profile.profile_image} name={profile.company_name || profile.contact_name} size="sm" className="!rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors truncate">
                  {profile.company_name || profile.contact_name}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {profile.business_type && <span>{getBusinessTypeLabel(profile.business_type)}</span>}
                  <span>{getRegionLabel(profile.region)}</span>
                </div>
              </div>
            </Link>
          ))}
        </Section>
      )}

      {/* 커뮤니티 */}
      {results.posts.length > 0 && (
        <Section title="커뮤니티" count={results.posts.length} moreHref={`${ROUTES.COMMUNITY}?search=${encodeURIComponent(q)}`}>
          {results.posts.map((post) => (
            <Link
              key={post.id}
              href={ROUTES.COMMUNITY_DETAIL(post.id)}
              className="flex items-center justify-between gap-3 py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold text-primary bg-primary-50 px-1.5 py-0.5 rounded">{getCategoryLabel(post.category)}</span>
                  <h3 className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors truncate">{post.title}</h3>
                </div>
                <p className="text-xs text-gray-400 truncate">{post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(post.created_at)}</span>
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, moreHref, children }: { title: string; count: number; moreHref: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-[15px] font-semibold text-gray-900">{title} <span className="text-primary text-sm font-normal ml-1">{count}</span></h2>
        <Link href={moreHref} className="text-xs text-gray-400 hover:text-primary transition-colors">더보기</Link>
      </div>
      <div className="divide-y divide-gray-50 px-2 py-1">
        {children}
      </div>
    </div>
  );
}

function JobItem({ job }: { job: Job }) {
  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <ProfileAvatar profileImage={job.author?.profile_image} name={job.author?.company_name || job.author?.contact_name || '?'} size="sm" className="!rounded-lg" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors truncate">{job.title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="font-medium text-gray-500">{job.author?.company_name || '알 수 없음'}</span>
          <span>|</span>
          <span>{getRegionLabel(job.region)}</span>
          <span>|</span>
          <span>{getEmploymentTypeLabel(job.employment_type)}</span>
        </div>
      </div>
      <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(job.created_at)}</span>
    </Link>
  );
}
