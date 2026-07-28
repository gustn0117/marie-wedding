import { cache } from 'react';
import { PUBLIC_JOB_COLUMNS } from '@/shared/constants/jobSelect';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES } from '@/shared/constants';
import {
  getBusinessTypeLabel,
  getRegionLabel,
  getEmploymentTypeLabel,
  formatDate,
} from '@/shared/utils/format';
import type { Profile, Job } from '@/types/database';
import RichTextView from '@/shared/components/RichTextView';
import type { Review, ReviewTag } from '@/types/database';
import ReviewList, { TagFrequency } from '@/features/reviews/components/ReviewList';
import StartMessageButton from '@/features/messages/components/StartMessageButton';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';
import GalleryLightbox from '@/shared/components/GalleryLightbox';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';
import JsonLd from '@/shared/components/JsonLd';
import { absoluteUrl, breadcrumbJsonLd, toPlainText, normalizeExternalUrl } from '@/shared/seo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

// 공개 디렉토리 프로필 Organization 구조화 데이터.
function buildProfileJsonLd(profile: Profile, includeAddress: boolean): Record<string, unknown> {
  const name = profile.company_name || profile.contact_name || '프로필';
  const biz = getBusinessTypeLabel(profile.business_type || '');
  const firstRegion = profile.region ? profile.region.split(',')[0] : '';
  const logo = resolveStorageUrl(profile.profile_image, 'avatars');
  const cover = resolveStorageUrl(profile.cover_image, 'avatars');
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: absoluteUrl(`/directory/${profile.id}`),
    ...(biz ? { description: toPlainText(profile.bio, 200) || `${biz} 웨딩 업체` } : {}),
    ...(logo ? { logo } : {}),
    ...(cover ? { image: cover } : {}),
    ...(normalizeExternalUrl(profile.website) ? { sameAs: [normalizeExternalUrl(profile.website)] } : {}),
    ...(profile.established_year ? { foundingDate: String(profile.established_year) } : {}),
    ...(firstRegion || profile.address
      ? {
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'KR',
            ...(firstRegion ? { addressRegion: getRegionLabel(firstRegion) } : {}),
            // 번지수는 화면과 동일하게 로그인 뷰어에게만. 시/도 단위는 남겨 지역 검색은 유지한다.
            ...(includeAddress && profile.address ? { streetAddress: profile.address } : {}),
          },
        }
      : {}),
  };
  return data;
}

const getData = cache(async (id: string) => {
  const supabase = createServerQueryClient();

  // 1) profile 먼저 확인 (없으면 즉시 종료)
  const { data: profile } = await supabase
    .from('profiles')
    // proxy_created_by 는 '관리자가 대신 만든 등재'인지 알려주는 표시용 플래그다.
    // 주인이 없는 프로필에 쪽지 버튼을 띄우면 아무도 읽지 않는 곳으로 문의가 사라진다.
    .select(`${PUBLIC_PROFILE_COLUMNS}, proxy_created_by`)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!profile) return null;

  // 2) jobs / reviews 는 profile.id 만 알면 되므로 병렬 실행
  const [jobsRes, reviewsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select(`${PUBLIC_JOB_COLUMNS}`)
      .eq('author_id', id)
      .is('deleted_at', null)
      // 관리자가 숨긴 공고(hidden_by_admin)·작성자가 내린 공고(status='hidden')는
      // 공개 프로필의 '채용 공고' 목록/카운트에서 제외. /jobs 목록과 동일한 필터쌍.
      // (두 컬럼 모두 NOT NULL + default 이므로 정상 공고가 누락되지 않음)
      .eq('hidden_by_admin', false)
      .neq('status', 'hidden')
      .order('created_at', { ascending: false }),
    supabase
      .from('reviews')
      // reviewer.deleted_at IS NULL — 탈퇴 리뷰어 실명 노출 방지
      .select('*, reviewer:profiles!reviewer_id!inner(id, company_name, contact_name, deleted_at)')
      .eq('reviewee_id', id)
      .eq('is_public', true)
      .eq('is_hidden_by_admin', false)
      .is('deleted_at', null)
      .is('reviewer.deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const reviews = (reviewsRes.data ?? []) as Review[];

  // 3) review tags 는 reviews 결과에 의존 — 별도 await
  const tagIds = Array.from(new Set(reviews.flatMap((r) => r.tags)));
  let tagRows: ReviewTag[] = [];
  if (tagIds.length > 0) {
    const { data: tagsData } = await supabase
      .from('review_tags')
      .select('*')
      .in('id', tagIds);
    tagRows = (tagsData ?? []) as ReviewTag[];
  }
  const tagMap: Record<string, ReviewTag> = Object.fromEntries(tagRows.map((t) => [t.id, t]));

  return {
    profile: profile as unknown as Profile,
    jobs: (jobsRes.data ?? []) as unknown as Job[],
    reviews,
    tagMap,
  };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getData(id);
  const profile = result?.profile;
  if (!profile || !profile.is_directory_listed) {
    return { title: '업체·인재 프로필', robots: { index: false, follow: true } };
  }
  const name = profile.company_name || profile.contact_name || '프로필';
  const biz = getBusinessTypeLabel(profile.business_type || '');
  const firstRegion = profile.region ? profile.region.split(',')[0] : '';
  const region = firstRegion ? getRegionLabel(firstRegion) : '';
  const title = biz ? `${name} · ${biz}` : name;
  const description = toPlainText(profile.bio, 150)
    || `${[region, biz].filter(Boolean).join(' · ')} — ${name} 웨딩 업체·인재 프로필`;
  const canonical = `/directory/${profile.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'profile', title, description, url: canonical },
    twitter: { title, description },
  };
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getData(id);
  if (!result) notFound();

  const { profile, jobs, reviews, tagMap } = result;

  const viewer = await getCurrentVerifiedProfile();
  const isOwner = viewer.ok && viewer.profileId === profile.id;
  const isProxyListing = !!(profile as { proxy_created_by?: string | null }).proxy_created_by;

  // 디렉토리 노출을 끈(is_directory_listed=false) 프로필은 본인 외에 내용을 보여주지 않는다 —
  // 목록/홈은 이미 is_directory_listed=true 만 노출하므로 상세도 동일 조건을 강제해 '숨김'
  // 옵트아웃이 실제로 동작하게 한다(공고/커뮤니티 작성자 id 로 우회 접근 차단).
  // 404 대신 '비공개' 안내를 띄운다: 공고에서 업체명을 눌러 들어온 사용자에게 404 는
  // 링크가 깨진 것처럼 보인다. 안내만 하고 프로필 내용은 아무것도 노출하지 않는다.
  if (!profile.is_directory_listed && !isOwner) {
    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="bg-white border-y border-gray-200 px-6 py-16 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <h1 className="text-lg font-bold text-gray-900">비공개 프로필입니다</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            이 회원이 아직 프로필을 공개하지 않았습니다.
            <br />
            프로필을 공개로 전환하면 소개·리뷰·채용 공고를 이곳에서 볼 수 있어요.
          </p>
          <Link
            href={ROUTES.DIRECTORY}
            className="mt-6 inline-block rounded border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition-colors"
          >
            인재·업체 프로필 보기
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.company_name || profile.contact_name;

  return (
    <div className="max-w-[1000px] mx-auto space-y-4">
      {profile.is_directory_listed && <JsonLd data={buildProfileJsonLd(profile, viewer.ok)} />}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '인재·업체 프로필', path: '/directory' },
          { name: displayName || '프로필', path: `/directory/${profile.id}` },
        ])}
      />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={ROUTES.DIRECTORY} className="hover:text-primary transition-colors">업체 디렉토리</Link>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-gray-900 font-medium truncate">{displayName}</span>
      </nav>

      {/* Cover Image (가로 배너) */}
      {(() => {
        const cover = resolveStorageUrl(profile.cover_image, 'avatars');
        if (!cover) return null;
        return (
          <div className="w-full aspect-[16/9] max-h-72 overflow-hidden border-y border-gray-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={`${displayName} 커버`} className="w-full h-full object-cover" />
          </div>
        );
      })()}

      {/* Hero Card */}
      <div className="bg-white border-y border-gray-200 p-6 md:p-8">
        {/* Avatar + Name + Edit */}
        <div className="flex items-start gap-5 mb-5">
          {/* Logo */}
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
            {(() => {
              const avatar = resolveStorageUrl(profile.profile_image, 'avatars');
              return avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-primary font-bold text-2xl">{displayName.charAt(0)}</span>
              );
            })()}
          </div>

          {/* Name + Tags */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-words">{displayName}</h1>
              {isOwner && (
                <Link
                  href={ROUTES.DIRECTORY_REGISTER}
                  className="shrink-0 rounded border border-gray-300 px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-colors"
                >
                  수정하기
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
        </div>

        {/* Quick Contact Actions */}
        <div className="flex flex-wrap gap-2 mb-6 pb-6 border-b border-gray-100">
            {profile.website && (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                웹사이트
              </a>
            )}
            {!isOwner && !isProxyListing && <StartMessageButton targetProfileId={profile.id} variant="secondary" />}
          </div>

        {/* 주인이 없는 등재 — 쪽지를 받을 사람이 없으므로 그 사실을 밝힌다. */}
        {isProxyListing && (
          <div className="mb-6 -mt-4 border border-gray-200 bg-gray-50 px-4 py-3 text-[12.5px] leading-relaxed text-gray-600">
            이 프로필은 업체 동의를 받아 마리에가 대신 등록했습니다. 아직 업체 계정과 연결되지 않아
            쪽지로는 답을 받을 수 없습니다. 문의는 <Link href={ROUTES.CONTACT} className="font-bold text-primary hover:underline">고객센터</Link>로 남겨주세요.
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-0 border border-gray-100">
          <InfoCell label="담당자" value={profile.contact_name} />
          {profile.company_size && (
            <InfoCell label="규모" value={profile.company_size === 'private' ? '비공개' : `${profile.company_size}명`} />
          )}
          {profile.established_year && (
            <InfoCell label="설립" value={`${profile.established_year}년`} />
          )}
          <InfoCell label="등록일" value={formatDate(profile.created_at)} />
          {/* 주소는 연락처급 정보다. 상세가 비로그인에 공개되므로 값만 가린다.
              (셀 자체를 없애면 마지막 행 테두리 처리가 어긋나고, 가입 유인도 사라진다) */}
          {profile.address && (
            <InfoCell label="주소" value={viewer.ok ? profile.address : '로그인 후 공개'} wide />
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="bg-white border-y border-gray-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">소개</h2>
          <RichTextView html={profile.bio} className="text-[15px] text-gray-700 leading-relaxed" />
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="bg-white border-y border-gray-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
            받은 리뷰 <span className="text-sm text-gray-400 font-normal ml-1">{reviews.length}</span>
          </h2>
          <section className="mb-6">
            <p className="text-xs text-gray-500 mb-3">받은 태그 빈도</p>
            <TagFrequency reviews={reviews} tagMap={tagMap} />
          </section>
          <section>
            <p className="text-xs text-gray-500 mb-3">개별 리뷰</p>
            <ReviewList reviews={reviews as Parameters<typeof ReviewList>[0]['reviews']} tagMap={tagMap} />
          </section>
        </div>
      )}

      {/* 갤러리 — 공개 프로필의 업체 사진. 클릭 시 lightbox 확대 표시. */}
      {profile.gallery && profile.gallery.length > 0 && (() => {
        const galleryUrls = profile.gallery
          .map((img) => resolveStorageUrl(img, 'avatars'))
          .filter((u): u is string => !!u);
        if (galleryUrls.length === 0) return null;
        return (
          <div className="bg-white border-y border-gray-200 p-6 md:p-8">
            <h2 className="text-lg font-bold text-ink mb-4 pb-3 border-b border-gray-200">
              갤러리 <span className="text-sm text-gray-400 font-normal ml-1">{galleryUrls.length}</span>
            </h2>
            <GalleryLightbox images={galleryUrls} altPrefix={`${displayName} 갤러리`} />
          </div>
        );
      })()}

      {/* Jobs */}
      <div className="bg-white border-y border-gray-200 p-6 md:p-8">
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
