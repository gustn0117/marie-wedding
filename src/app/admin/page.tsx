'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/features/admin/services/admin-service';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime, getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Profile, Job } from '@/types/database';

interface Stats {
  users: number;
  jobs: number;
  posts: number;
  comments: number;
  recentUsers: number;
  recentJobs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<Profile[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, u, j] = await Promise.all([
          adminService.getStats(),
          adminService.getRecentUsers(5),
          adminService.getRecentJobs(5),
        ]);
        setStats(s);
        setRecentUsers(u);
        setRecentJobs(j);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: '전체 회원', value: stats?.users ?? 0, change: `+${stats?.recentUsers ?? 0} 이번 주`, href: ROUTES.ADMIN_USERS, color: 'text-blue-600 bg-blue-50' },
    { label: '채용 공고', value: stats?.jobs ?? 0, change: `+${stats?.recentJobs ?? 0} 이번 주`, href: ROUTES.ADMIN_JOBS, color: 'text-green-600 bg-green-50' },
    { label: '게시글', value: stats?.posts ?? 0, change: '', href: ROUTES.ADMIN_POSTS, color: 'text-purple-600 bg-purple-50' },
    { label: '댓글', value: stats?.comments ?? 0, change: '', href: ROUTES.ADMIN_COMMENTS, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{card.value.toLocaleString()}</p>
            {card.change && (
              <p className="text-xs text-green-600 mt-1">{card.change}</p>
            )}
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">최근 가입 회원</h2>
            <Link href={ROUTES.ADMIN_USERS} className="text-sm text-primary hover:underline">전체보기</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentUsers.length === 0 ? (
              <p className="p-5 text-sm text-gray-400 text-center">아직 회원이 없습니다.</p>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                    {user.contact_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {user.contact_name}
                      {user.company_name && <span className="text-gray-400 ml-1">({user.company_name})</span>}
                    </p>
                    <p className="text-xs text-gray-400">
                      {user.account_type === 'business' ? '업체' : '개인'} · {getRegionLabel(user.region)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(user.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">최근 등록 공고</h2>
            <Link href={ROUTES.ADMIN_JOBS} className="text-sm text-primary hover:underline">전체보기</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentJobs.length === 0 ? (
              <p className="p-5 text-sm text-gray-400 text-center">아직 공고가 없습니다.</p>
            ) : (
              recentJobs.map((job) => (
                <div key={job.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold ${
                    job.posting_type === 'hiring' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {job.posting_type === 'hiring' ? '채용' : '섭외'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{job.title}</p>
                    <p className="text-xs text-gray-400">
                      {job.author?.company_name || job.author?.contact_name} · {getBusinessTypeLabel(job.business_type)} · {getRegionLabel(job.region)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(job.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
