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
import RichTextView from '@/shared/components/RichTextView';
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

  let isOwner = false;
  try {
    const cookieStore = await cookies();
    const profileCookie = cookieStore.get('marie_profile');
    if (profileCookie?.value) {
      const me = JSON.parse(profileCookie.value);
      isOwner = me.id === profile.id;
    }
  } catch {}

  const displayName = profile.company_name || profile.contact_name;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={ROUTES.DIRECTORY} className="hover:text-primary transition-colors">업체 디렉토리</Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium truncate">{displayName}</span>
      </nav>

      {/* Hero Card */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        {/* Cover (first gallery image or gradient) */}
        <div className="h-32 sm:h-40 bg-gradient-to-br from-primary/20 via-primary-50 to-primary-100 relative">
          {profile.gallery && profile.gallery.length > 0 && (
            <img
              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.gallery[0]}`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-70"
            />
          )}
        </div>

        <div className="px-6 md:px-8 pb-6">
          {/* Avatar + Edit button row */}
          <div className="flex items-start justify-between -mt-12 mb-4">
            <ProfileAvatar
              profileImage={profile.profile_image}
              name={displayName}
              size="lg"
              className="!w-24 !h-24 !rounded-xl border-4 border-white shadow-sm"
            />
            {isOwner && (
              <Link
                href={ROUTES.DIRECTORY_REGISTER}
                className="mt-14 px-4 py-2 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                수정하기
              </Link>
            )}
          </div>

          {/* Name + Tags */}
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-words mb-2">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              {profile.business_type && profile.business_type.split(',').filter(Boolean).map((bt) => (
                <span key={bt} className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary text-xs font-semibold">
                  {getBusinessTypeLabel(bt.trim())}
                </span>
              ))}
              <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold">
                {getRegionLabel(profile.region)}
              </span>
            </div>
          </div>

          {/* Quick Contact Actions */}
          <div className="flex flex-wrap gap-2 mb-6 pb-6 border-b border-gray-100">
            {profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {profile.phone}
              </a>
            )}
            {profile.website && (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                웹사이트
              </a>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border border-gray-100">
            <InfoCell label="담당자" value={profile.contact_name} />
            {profile.company_size && (
              <InfoCell label="규모" value={profile.company_size === 'private' ? '비공개' : `${profile.company_size}명`} />
            )}
            {profile.established_year && (
              <InfoCell label="설립" value={`${profile.established_year}년`} />
            )}
            <InfoCell label="등록일" value={formatDate(profile.created_at)} />
            {profile.address && (
              <InfoCell label="주소" value={profile.address} wide />
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="bg-white border border-gray-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">소개</h2>
          <RichTextView html={profile.bio} className="text-[15px] text-gray-700 leading-relaxed" />
        </div>
      )}

      {/* Gallery */}
      {profile.gallery && profile.gallery.length > 0 && (
        <div className="bg-white border border-gray-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
            갤러리 <span className="text-sm text-gray-400 font-normal ml-1">{profile.gallery.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {profile.gallery.map((img, i) => (
              <a
                key={i}
                href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${img}`}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square overflow-hidden border border-gray-200 group hover:border-primary transition-colors block"
              >
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${img}`}
                  alt={`갤러리 ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Jobs */}
      <div className="bg-white border border-gray-200 p-6 md:p-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
          채용 공고 <span className="text-sm text-gray-400 font-normal ml-1">{jobs.length}</span>
        </h2>
        {jobs.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            <p className="text-sm text-gray-400">등록된 채용 공고가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={ROUTES.JOBS_DETAIL(job.id)}
                className="flex items-center justify-between gap-3 py-3.5 hover:bg-gray-50 -mx-3 px-3 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors truncate mb-1">{job.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                    <span>·</span>
                    <span>{getRegionLabel(job.region)}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{formatDate(job.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCell({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`px-4 py-3 border-r border-b border-gray-100 last:border-r-0 ${wide ? 'col-span-2 sm:col-span-4 border-b-0' : ''}`}>
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
    </div>
  );
}
