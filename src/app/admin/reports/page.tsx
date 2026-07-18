'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService, type ReportStatusStats } from '@/features/admin/services/admin-service';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import type { Profile, Report } from '@/types/database';
import { toast } from '@/shared/components/Toast';
import { withTimeout } from '@/shared/utils/withTimeout';

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

export default function AdminReportsPage() {
  const [reports, setReports] = useState<(Report & { reporter?: Profile })[]>([]);
  const [status, setStatus] = useState<Report['status'] | ''>('open');
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<ReportStatusStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const totalPages = Math.ceil(count / 20);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await withTimeout(
        adminService.getReports(page, status || undefined),
        10000,
        '신고 조회 지연',
      );
      setReports(result.data);
      setCount(result.count);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '신고를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  const loadStats = useCallback(async () => {
    setStatsError(null);
    try {
      setStats(await adminService.getReportStats());
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : '신고 통계를 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadStats(); }, [loadStats]);

  const updateStatus = async (report: Report, next: Report['status']) => {
    setActionLoading(report.id);
    try {
      const updated = await adminService.updateReportStatus(report.id, next);
      // 낙관적 즉시 반영 후, 상태 필터가 걸린 목록·헤더 count 를 서버 기준으로 재동기화.
      // (필터가 'resolved'인데 'reviewing'으로 바꾸면 그 행은 목록에서 빠져야 count 와 맞는다.)
      setReports((prev) => prev.map((item) => (item.id === report.id ? { ...item, ...updated } : item)));
      toast('상태를 변경했습니다.', 'success');
      void load();
      void loadStats();
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
          <h1 className="page-title">신고 관리</h1>
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
      {statsError && (
        <div className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{statsError}</span>
          <button type="button" onClick={() => void loadStats()} className="shrink-0 text-xs font-bold underline">
            다시 시도
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => { setStatus(option.value); setPage(1); }}
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
        ) : loadError ? (
          <div className="p-12 text-center">
            <p className="text-sm text-rose-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary"
            >
              다시 시도
            </button>
          </div>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 px-5 py-4 border-t border-gray-100">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              이전
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-sm rounded ${
                    p === page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
