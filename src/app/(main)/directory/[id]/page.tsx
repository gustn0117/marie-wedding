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
  formatRelativeTime,
} from '@/shared/utils/format';
import type { Profile, Job } from '@/types/database';
import RichTextView from '@/shared/components/RichTextView';

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

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;

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
  const businessTypes = profile.business_type ? profile.business_type.split(',').filter(Boolean).map(s => s.trim()) : [];
  const galleryImages = profile.gallery ?? [];
  const heroImage = galleryImages[0] ?? null;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={ROUTES.DIRECTORY} className="hover:text-primary transition-colors">업체 디렉토리</Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium truncate">{displayName}</span>
      </nav>

      {/* Hero - 풀와이드 이미지 or 그라데이션 */}
      <div className="relative w-full aspect-[3/1] sm:aspect-[5/2] bg-gradient-to-br from-primary/10 via-primary-50 to-primary/20 overflow-hidden">
        {heroImage ? (
          <>
            <img
              src={`${SB}/storage/v1/object/public/avatars/${heroImage}`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-[120px] sm:text-[200px] text-primary/10 font-bold leading-none">
              {displayName.charAt(0)}
            </span>
          </div>
        )}

        {/* 오버레이 정보 */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            {/* Logo */}
            <div className="w-20 h-20 md:w-28 md:h-28 bg-white border-4 border-white shadow-lg overflow-hidden flex items-center justify-center shrink-0">
              {profile.profile_image ? (
                <img
                  src={`${SB}/storage/v1/object/public/avatars/${profile.profile_image}`}
                  alt={displayName}
                  className="w-full h-full object-contain p-1.5"
                />
              ) : (
                <span className="text-primary font-bold text-3xl">{displayName.charAt(0)}</span>
              )}
            </div>
            <div className={`${heroImage ? 'text-white' : 'text-gray-900'} pb-1`}>
              <h1 className="text-2xl md:text-4xl font-bold break-words drop-shadow-md">{displayName}</h1>
              <p className={`text-sm mt-1 ${heroImage ? 'text-white/90' : 'text-gray-600'}`}>
                {businessTypes.length > 0 && businessTypes.map(bt => getBusinessTypeLabel(bt)).join(' · ')}
              </p>
            </div>
          </div>
          {isOwner && (
            <Link
              href={ROUTES.DIRECTORY_REGISTER}
              className="hidden sm:inline-flex shrink-0 items-center gap-1.5 px-4 py-2 bg-white/95 text-gray-800 text-sm font-semibold hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              수정
            </Link>
          )}
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Main Column */}
        <div className="space-y-5 min-w-0">
          {/* Quick Meta Row */}
          <div className="bg-white border border-gray-200 p-5">
            <div className="flex flex-wrap items-center gap-3">
              {businessTypes.map((bt) => (
                <span key={bt} className="inline-flex items-center px-3 py-1 bg-primary-50 text-primary text-xs font-semibold">
                  {getBusinessTypeLabel(bt)}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {getRegionLabel(profile.region)}
              </span>
            </div>
          </div>

          {/* Info Grid */}
          <div className="bg-white border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">업체 정보</h2>
            </div>
            <div className="grid grid-cols-2 gap-0">
              <InfoCell label="담당자" value={profile.contact_name} icon="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              {profile.company_size && (
                <InfoCell label="업체 규모" value={profile.company_size === 'private' ? '비공개' : `${profile.company_size}명`} icon="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              )}
              {profile.established_year && (
                <InfoCell label="설립연도" value={`${profile.established_year}년`} icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              )}
              <InfoCell label="등록일" value={formatDate(profile.created_at)} icon="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
              {profile.address && (
                <div className="col-span-2 px-5 py-4 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-0.5">주소</p>
                      <p className="text-sm font-medium text-gray-900">{profile.address}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="bg-white border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">업체 소개</h2>
              </div>
              <div className="p-5 md:p-6">
                <RichTextView html={profile.bio} className="text-[15px] text-gray-700 leading-relaxed" />
              </div>
            </div>
          )}

          {/* Gallery */}
          {galleryImages.length > 0 && (
            <div className="bg-white border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">
                  갤러리 <span className="text-primary ml-1">{galleryImages.length}</span>
                </h2>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {galleryImages.map((img, i) => (
                    <a
                      key={i}
                      href={`${SB}/storage/v1/object/public/avatars/${img}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square overflow-hidden bg-gray-100 group relative"
                    >
                      <img
                        src={`${SB}/storage/v1/object/public/avatars/${img}`}
                        alt={`갤러리 ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                        </svg>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Jobs */}
          <div className="bg-white border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                채용 공고 <span className="text-primary ml-1">{jobs.length}</span>
              </h2>
            </div>
            {jobs.length === 0 ? (
              <div className="text-center py-10">
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <p className="text-sm text-gray-400">등록된 채용 공고가 없습니다.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={ROUTES.JOBS_DETAIL(job.id)}
                      className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors truncate mb-1">{job.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                          <span className="text-gray-300">·</span>
                          <span>{getRegionLabel(job.region)}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(job.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar - Sticky Contact */}
        <aside className="lg:sticky lg:top-[130px] lg:self-start space-y-3">
          <div className="bg-white border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">연락하기</h3>
            <div className="space-y-2">
              {profile.phone ? (
                <a
                  href={`tel:${profile.phone}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white font-semibold hover:bg-primary-dark transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  <span>{profile.phone}</span>
                </a>
              ) : (
                <div className="px-4 py-3 bg-gray-50 text-gray-400 text-sm text-center">전화번호 미공개</div>
              )}
              {profile.website && (
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  웹사이트 방문
                </a>
              )}
              {isOwner && (
                <Link
                  href={ROUTES.DIRECTORY_REGISTER}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  정보 수정
                </Link>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 border border-gray-200 p-5 text-xs text-gray-500 space-y-1.5">
            <div className="flex items-center justify-between">
              <span>채용 공고</span>
              <span className="font-semibold text-gray-900">{jobs.length}건</span>
            </div>
            {galleryImages.length > 0 && (
              <div className="flex items-center justify-between">
                <span>갤러리</span>
                <span className="font-semibold text-gray-900">{galleryImages.length}장</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>등록</span>
              <span className="font-semibold text-gray-900">{formatDate(profile.created_at)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoCell({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="px-5 py-4 border-r border-b border-gray-100 last:border-r-0 even:border-r-0">
      <div className="flex items-start gap-3">
        <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
          <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
