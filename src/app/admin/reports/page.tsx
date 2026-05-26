'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/features/admin/services/admin-service';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import type { Profile, Report } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/shared/components/Toast';

const STATUS_OPTIONS: { value: Report['status'] | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'open', label: '접수' },
  { value: 'reviewing', label: '검토 중' },
  { value: 'resolved', label: '처리 완료' },
  { value: 'dismissed', label: '반려' },
];

const STATUS_LABELS: Record<Report['status'], string> = {
  open: '접수',
  reviewing: '검토 중',
  resolved: '처리 완료',
  dismissed: '반려',
};

const TARGET_LABELS: Record<Report['target_type'], string> = {
  job: '공고',
  profile: '프로필',
  post: '게시글',
  comment: '댓글',
  event: '이벤트',
  review: '리뷰',
};

function StatTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`border bg-white p-4 ${highlight ? 'border-primary' : 'border-gray-200'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-primary' : 'text-gray-700'}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function targetHref(report: Report): string {
  if (report.target_type === 'job') return ROUTES.JOBS_DETAIL(report.target_id);
  if (report.target_type === 'post') return ROUTES.COMMUNITY_DETAIL(report.target_id);
  if (report.target_type === 'profile') return ROUTES.DIRECTORY_DETAIL(report.target_id);
  if (report.target_type === 'event') return ROUTES.EVENTS_DETAIL(report.target_id);
  return ROUTES.ADMIN_COMMENTS;
}

interface StatusStats {
  open: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  today: number;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<(Report & { reporter?: Profile })[]>([]);
  const [status, setStatus] = useState<Report['status'] | ''>('open');
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<StatusStats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminService.getReports(1, status || undefined);
      setReports(result.data);
      setCount(result.count);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadStats = useCallback(async () => {
    const sb = createClient();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayIso = startOfDay.toISOString();
    const [openRes, reviewingRes, resolvedRes, dismissedRes, todayRes] = await Promise.all([
      sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'reviewing'),
      sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
      sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'dismissed'),
      sb.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    ]);
    setStats({
      open: openRes.count ?? 0,
      reviewing: reviewingRes.count ?? 0,
      resolved: resolvedRes.count ?? 0,
      dismissed: dismissedRes.count ?? 0,
      today: todayRes.count ?? 0,
    });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const updateStatus = async (report: Report, next: Report['status']) => {
    setActionLoading(report.id);
    try {
      const updated = await adminService.updateReportStatus(report.id, next);
      setReports((prev) => prev.map((item) => (item.id === report.id ? { ...item, ...updated } : item)));
      toast('상태를 변경했습니다.', 'success');
      loadStats();
    } catch {
      toast('상태 변경에 실패했습니다.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">신고 관리</h1>
          <p className="mt-1 text-sm text-gray-500">총 {count.toLocaleString()}건</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatTile label="처리 대기" value={stats.open} highlight />
          <StatTile label="검토 중" value={stats.reviewing} />
          <StatTile label="처리 완료" value={stats.resolved} />
          <StatTile label="반려" value={stats.dismissed} />
          <StatTile label="오늘 신규" value={stats.today} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => setStatus(option.value)}
            className={`rounded border px-4 py-2 text-sm font-bold transition-colors ${
              status === option.value
                ? 'border-primary bg-primary text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-primary hover:text-primary'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">신고를 불러오는 중...</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">신고 내역이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((report) => (
              <article key={report.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge-primary">{TARGET_LABELS[report.target_type]}</span>
                      <span className="badge-attr">{STATUS_LABELS[report.status]}</span>
                      <time className="text-xs text-gray-400">{formatRelativeTime(report.created_at)}</time>
                    </div>
                    <h2 className="mt-2 text-base font-bold text-gray-900">{report.reason}</h2>
                    {report.details && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{report.details}</p>}
                    <p className="mt-2 text-xs text-gray-400">
                      신고자 {report.reporter?.company_name || report.reporter?.contact_name || '익명'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Link href={targetHref(report)} className="btn-outline text-xs px-3 py-1.5">대상 보기</Link>
                    {(['reviewing', 'resolved', 'dismissed'] as Report['status'][]).map((next) => (
                      <button
                        key={next}
                        type="button"
                        onClick={() => updateStatus(report, next)}
                        disabled={actionLoading === report.id || report.status === next}
                        className="rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-primary hover:text-primary disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {STATUS_LABELS[next]}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
