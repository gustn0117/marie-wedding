'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import { jobService } from '@/features/jobs/services/job-service';
import { communityService } from '@/features/community/services/community-service';
import {
  getBusinessTypeLabel,
  getRegionLabel,
  getEmploymentTypeLabel,
  formatRelativeTime,
  getCategoryLabel,
  formatDate,
} from '@/shared/utils/format';
import type { Job, Post } from '@/types/database';

export default function MyPage() {
  const { user, profile, isLoading, isAuthenticated } = useAuth();
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'jobs' | 'posts'>('jobs');
  const [loading, setLoading] = useState(true);

  const fetchMyData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [jobsRes, postsRes] = await Promise.all([
        jobService.getJobs({ authorId: profile.id }, 1, 50),
        communityService.getPosts({ authorId: profile.id }, 1, 50),
      ]);
      setMyJobs(jobsRes.data);
      setMyPosts(postsRes.data);
    } catch (err) {
      console.error('Failed to fetch my data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) fetchMyData();
  }, [profile, fetchMyData]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-4">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-full bg-gray-200" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">로그인이 필요합니다</h2>
        <Link href={ROUTES.LOGIN} className="btn-primary text-sm">로그인하기</Link>
      </div>
    );
  }

  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">마이페이지</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Avatar + Name + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-xl">
                  {(profile.company_name || profile.contact_name).charAt(0)}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {profile.company_name || profile.contact_name}
              </h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                profile.account_type === 'business' ? 'bg-primary-50 text-primary' : 'bg-gray-100 text-gray-600'
              }`}>
                {profile.account_type === 'business' ? '업체' : '개인'}
              </span>
            </div>
            {profile.account_type === 'business' && profile.contact_name && (
              <p className="text-sm text-gray-500">{profile.contact_name}</p>
            )}
            {profile.bio && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{profile.bio}</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Link href={ROUTES.MYPAGE_EDIT} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              프로필 수정
            </Link>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profile.business_type && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
              <span className="text-gray-500">{getBusinessTypeLabel(profile.business_type)}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="text-gray-500">{getRegionLabel(profile.region)}</span>
          </div>
          {user?.email && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <span className="text-gray-500">{user.email}</span>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <span className="text-gray-500">{profile.phone}</span>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{profile.website}</a>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-gray-500">{formatDate(profile.created_at)} 가입</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
          <Link href={ROUTES.MYPAGE_EDIT} className="text-sm text-gray-500 hover:text-primary transition-colors">프로필 수정</Link>
          <span className="text-gray-200">|</span>
          <Link href={ROUTES.MYPAGE_PASSWORD} className="text-sm text-gray-500 hover:text-primary transition-colors">비밀번호 변경</Link>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">등록한 공고</p>
          <p className="text-2xl font-bold text-gray-900">{myJobs.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">작성한 게시글</p>
          <p className="text-2xl font-bold text-gray-900">{myPosts.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('jobs')}
              className={`flex-1 px-5 py-3.5 text-sm font-semibold transition-colors ${
                activeTab === 'jobs' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              내 공고
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 px-5 py-3.5 text-sm font-semibold transition-colors ${
                activeTab === 'posts' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              내 게시글
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse p-4 rounded-lg bg-gray-50">
                  <div className="h-5 w-3/4 bg-gray-200 rounded" />
                  <div className="h-4 w-1/4 bg-gray-200 rounded mt-2" />
                </div>
              ))}
            </div>
          ) : activeTab === 'jobs' ? (
            myJobs.length === 0 ? (
              <div className="text-center py-10">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <p className="text-sm text-gray-400 mb-4">등록한 공고가 없습니다.</p>
                <Link href={ROUTES.JOBS_NEW} className="btn-primary text-sm">공고 등록하기</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {myJobs.map((job) => (
                  <Link key={job.id} href={ROUTES.JOBS_DETAIL(job.id)} className="flex items-center justify-between gap-3 py-3.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {job.is_urgent && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">긴급</span>}
                        <h3 className="text-sm font-medium text-gray-800 group-hover:text-primary transition-colors truncate">
                          {job.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                        <span>·</span>
                        <span>{getRegionLabel(job.region)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(job.created_at)}</span>
                  </Link>
                ))}
              </div>
            )
          ) : (
            myPosts.length === 0 ? (
              <div className="text-center py-10">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm text-gray-400 mb-4">작성한 게시글이 없습니다.</p>
                <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary text-sm">글 작성하기</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {myPosts.map((post) => (
                  <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="flex items-center justify-between gap-3 py-3.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-primary bg-primary-50 px-1.5 py-0.5 rounded">{getCategoryLabel(post.category)}</span>
                        <h3 className="text-sm font-medium text-gray-800 group-hover:text-primary transition-colors truncate">
                          {post.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>조회 {post.view_count}</span>
                        {post.comment_count !== undefined && post.comment_count > 0 && (
                          <>
                            <span>·</span>
                            <span>댓글 {post.comment_count}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(post.created_at)}</span>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
