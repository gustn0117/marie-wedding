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
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-32 bg-secondary rounded" />
        <div className="card p-8 space-y-4">
          <div className="h-16 w-16 rounded-full bg-secondary" />
          <div className="h-6 w-48 bg-secondary rounded" />
          <div className="h-4 w-32 bg-secondary rounded" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-text-primary mb-3">로그인이 필요합니다</h2>
        <Link href={ROUTES.LOGIN} className="btn-primary text-sm">로그인하기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">마이페이지</h1>

      {/* Profile Card */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-bold text-2xl">
              {(profile.company_name || profile.contact_name).charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-text-primary truncate">
                {profile.company_name || profile.contact_name}
              </h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                profile.account_type === 'business' ? 'bg-primary-50 text-primary' : 'bg-gray-100 text-gray-600'
              }`}>
                {profile.account_type === 'business' ? '업체' : '개인'}
              </span>
            </div>
            <p className="text-sm text-text-secondary">{profile.contact_name}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.business_type && (
                <span className="badge-primary text-xs">{getBusinessTypeLabel(profile.business_type)}</span>
              )}
              <span className="badge-accent text-xs">{getRegionLabel(profile.region)}</span>
            </div>
            {profile.bio && (
              <p className="text-sm text-text-muted mt-3">{profile.bio}</p>
            )}
            {user?.email && (
              <p className="text-xs text-text-muted mt-2">{user.email}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          <Link href={ROUTES.MYPAGE_EDIT} className="btn-outline text-sm px-5 py-2">프로필 수정</Link>
          <Link href={ROUTES.MYPAGE_PASSWORD} className="btn-secondary text-sm px-5 py-2">비밀번호 변경</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'jobs' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            내 공고 ({myJobs.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'posts' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            내 게시글 ({myPosts.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse p-4">
              <div className="h-5 w-3/4 bg-secondary rounded" />
              <div className="h-4 w-1/4 bg-secondary rounded mt-2" />
            </div>
          ))}
        </div>
      ) : activeTab === 'jobs' ? (
        myJobs.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm text-text-muted mb-4">등록한 공고가 없습니다.</p>
            <Link href={ROUTES.JOBS_NEW} className="btn-primary text-sm">공고 등록하기</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myJobs.map((job) => (
              <Link key={job.id} href={ROUTES.JOBS_DETAIL(job.id)} className="card block group">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {job.is_urgent && <span className="badge-urgent text-xs">긴급</span>}
                      <h3 className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                        {job.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>{getEmploymentTypeLabel(job.employment_type)}</span>
                      <span>·</span>
                      <span>{getRegionLabel(job.region)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{formatRelativeTime(job.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        myPosts.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm text-text-muted mb-4">작성한 게시글이 없습니다.</p>
            <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary text-sm">글 작성하기</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myPosts.map((post) => (
              <Link key={post.id} href={ROUTES.COMMUNITY_DETAIL(post.id)} className="card block group">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-primary text-xs">{getCategoryLabel(post.category)}</span>
                      <h3 className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                        {post.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>조회 {post.view_count}</span>
                      {post.comment_count !== undefined && (
                        <>
                          <span>·</span>
                          <span>댓글 {post.comment_count}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{formatRelativeTime(post.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
