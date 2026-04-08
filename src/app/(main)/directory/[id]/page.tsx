import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import {
  getBusinessTypeLabel,
  getRegionLabel,
  getEmploymentTypeLabel,
  formatDate,
} from '@/shared/utils/format';
import type { Profile, Job } from '@/types/database';
import ProfileAvatar from '@/shared/components/ProfileAvatar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getData(id: string) {
  const supabase = createServerQueryClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!profile) return null;

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('author_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return { profile: profile as Profile, jobs: (jobs ?? []) as Job[] };
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const result = await getData(params.id);
  if (!result) notFound();

  const { profile, jobs } = result;

  // 현재 로그인 사용자인지 확인
  let isOwner = false;
  try {
    const cookieStore = await cookies();
    const profileCookie = cookieStore.get('marie_profile');
    if (profileCookie?.value) {
      const me = JSON.parse(profileCookie.value);
      isOwner = me.id === profile.id;
    }
  } catch {}
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={ROUTES.DIRECTORY} className="hover:text-primary transition-colors">업체 디렉토리</Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium truncate">{profile.company_name || profile.contact_name}</span>
      </nav>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          <ProfileAvatar profileImage={profile.profile_image} name={profile.company_name || profile.contact_name} size="lg" className="!rounded-xl" />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900">{profile.company_name || profile.contact_name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="badge-primary">{profile.business_type ? getBusinessTypeLabel(profile.business_type) : '개인'}</span>
              <span className="badge-accent">{getRegionLabel(profile.region)}</span>
            </div>
          </div>
          {isOwner && (
            <Link
              href={ROUTES.DIRECTORY_REGISTER}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            >
              수정하기
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <div>
              <p className="text-xs text-gray-400">담당자</p>
              <p className="text-sm font-medium text-gray-800">{profile.contact_name}</p>
            </div>
          </div>
          {profile.phone && (
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <div>
                <p className="text-xs text-gray-400">연락처</p>
                <a href={`tel:${profile.phone}`} className="text-sm font-medium text-gray-800 hover:text-primary">{profile.phone}</a>
              </div>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <div>
                <p className="text-xs text-gray-400">웹사이트</p>
                <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block max-w-[200px]">{profile.website}</a>
              </div>
            </div>
          )}
        </div>

        {/* Additional Info */}
        {(profile.company_size || profile.established_year || profile.address) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl mb-6">
            {profile.company_size && (
              <div>
                <p className="text-xs text-gray-400">업체 규모</p>
                <p className="text-sm font-medium text-gray-800">{profile.company_size}명</p>
              </div>
            )}
            {profile.established_year && (
              <div>
                <p className="text-xs text-gray-400">설립연도</p>
                <p className="text-sm font-medium text-gray-800">{profile.established_year}년</p>
              </div>
            )}
            {profile.address && (
              <div>
                <p className="text-xs text-gray-400">주소</p>
                <p className="text-sm font-medium text-gray-800">{profile.address}</p>
              </div>
            )}
          </div>
        )}

        {profile.bio && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">소개</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </div>
        )}

        {/* Gallery */}
        {profile.gallery && profile.gallery.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">갤러리</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {profile.gallery.map((img, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${img}`}
                    alt={`갤러리 ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">채용 공고</h2>
        {jobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 text-center py-10">
            <p className="text-sm text-gray-400">현재 등록된 채용 공고가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link key={job.id} href={ROUTES.JOBS_DETAIL(job.id)} className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all group">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-gray-900 group-hover:text-primary transition-colors truncate">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="badge-primary text-xs">{getEmploymentTypeLabel(job.employment_type)}</span>
                      <span className="text-xs text-gray-400">{getRegionLabel(job.region)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {job.is_urgent && <span className="badge-accent text-xs font-semibold">긴급</span>}
                    <span className="text-xs text-gray-400">{formatDate(job.created_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
