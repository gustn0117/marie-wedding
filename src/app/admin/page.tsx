'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/features/admin/services/admin-service';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime, getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import type { Profile, Job } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface Stats {
  users: number;
  jobs: number;
  posts: number;
  comments: number;
  reports: number;
  recentUsers: number;
  recentJobs: number;
}

interface FunnelStats {
  totalApplications: number;
  acceptedApplications: number;
  completedDeals: number;
  reviewsWritten: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<Profile[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
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

        // 퍼널 — 클라이언트 직접 query (admin RLS)
        const sb = createClient();
        const [appAll, appAccepted, deals, reviews] = await Promise.all([
          sb.from('applications').select('id', { count: 'exact', head: true }).is('deleted_at', null),
          sb.from('applications').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'accepted'),
          sb.from('applications').select('id', { count: 'exact', head: true })
            .is('deleted_at', null).not('hiring_completed_at', 'is', null).not('applicant_completed_at', 'is', null),
          sb.from('reviews').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        ]);
        setFunnel({
          totalApplications: appAll.count ?? 0,
          acceptedApplications: appAccepted.count ?? 0,
          completedDeals: deals.count ?? 0,
          reviewsWritten: reviews.count ?? 0,
        });
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
        <h1 className="page-title">대시보드</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded border border-gray-200 p-5 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: '전체 회원', value: stats?.users ?? 0, change: `+${stats?.recentUsers ?? 0} 이번 주`, href: ROUTES.ADMIN_USERS, color: 'text-primary-600 bg-primary-50' },
    { label: '채용 공고', value: stats?.jobs ?? 0, change: `+${stats?.recentJobs ?? 0} 이번 주`, href: ROUTES.ADMIN_JOBS, color: 'text-state-new bg-state-new-bg' },
    { label: '게시글', value: stats?.posts ?? 0, change: '', href: ROUTES.ADMIN_POSTS, color: 'text-accent bg-accent-50' },
    { label: '미처리 신고', value: stats?.reports ?? 0, change: '', href: ROUTES.ADMIN_REPORTS, color: 'text-state-urgent bg-state-urgent-bg' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="page-title">대시보드</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{card.value.toLocaleString()}</p>
            {card.change && (
              <p className="text-xs text-state-new mt-1">{card.change}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Conversion Funnel */}
      {funnel && (
        <section className="bg-white rounded border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-1">전환 퍼널</h2>
          <p className="text-xs text-gray-500 mb-4">지원 → 승인 → 거래 완료 → 리뷰 단계별 누적 수치 (% = 지원 대비)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FunnelStep label="지원/문의" value={funnel.totalApplications} base={funnel.totalApplications} highlight />
            <FunnelStep label="승인" value={funnel.acceptedApplications} base={funnel.totalApplications} />
            <FunnelStep label="거래 완료" value={funnel.completedDeals} base={funnel.totalApplications} />
            <FunnelStep label="리뷰 작성" value={funnel.reviewsWritten} base={funnel.totalApplications} />
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded border border-gray-200">
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
        <div className="bg-white rounded border border-gray-200">
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
                    job.posting_type === 'hiring' ? 'bg-primary-50 text-primary-600' : 'bg-accent-50 text-accent'
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

function FunnelStep({ label, value, base, highlight }: { label: string; value: number; base: number; highlight?: boolean }) {
  const pct = base > 0 ? Math.round((value / base) * 100) : 0;
  return (
    <div className={`border bg-white p-4 ${highlight ? 'border-primary' : 'border-gray-200'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-primary' : 'text-gray-700'}`}>{value.toLocaleString()}</p>
      <div className="mt-2 h-1 bg-gray-100">
        <div className="h-full bg-gray-800" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-gray-400 tabular-nums">{pct}%</p>
    </div>
  );
}
