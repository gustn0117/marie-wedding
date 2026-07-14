'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { adminService, type AuditLogRow } from '@/features/admin/services/admin-service';
import { ROUTES } from '@/shared/constants';
import AuditLogDiff from '@/features/admin/components/AuditLogDiff';

const TABLE_LABELS: Record<string, string> = {
  profiles: '회원/프로필',
  jobs: '공고',
  applications: '지원',
  posts: '게시글',
  comments: '댓글',
  reviews: '리뷰',
  reports: '신고',
  payments: '결제',
  banners: '배너',
};
const TABLE_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.entries(TABLE_LABELS).map(([value, label]) => ({ value, label })),
];

const ACTION_LABELS: Record<string, string> = { insert: '생성', update: '변경', delete: '삭제' };
const ACTION_TONES: Record<string, string> = {
  insert: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-rose-50 text-rose-700 border-rose-200',
};
const ACTION_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
];

const PAGE_SIZE = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AdminAuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    const recordId = recordIdFilter.trim();
    if (recordId && !UUID_RE.test(recordId)) {
      setRows([]);
      setError('레코드 ID는 전체 UUID 형식으로 입력해 주세요.');
      setLoading(false);
      return;
    }
    try {
      const data = await adminService.getAuditLog({
        page,
        table: tableFilter || undefined,
        changeAction: actionFilter || undefined,
        recordId: recordId || undefined,
      });
      if (requestId !== requestSequence.current) return;
      setRows(data);
    } catch (err) {
      if (requestId === requestSequence.current) {
        setError(err instanceof Error ? err.message : '로그 로드 실패');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [tableFilter, actionFilter, recordIdFilter, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, recordIdFilter ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, recordIdFilter]);

  const linkForRecord = (table: string, id: string) => {
    switch (table) {
      case 'jobs': return ROUTES.JOBS_DETAIL(id);
      case 'profiles': return ROUTES.DIRECTORY_DETAIL(id);
      case 'posts': return ROUTES.COMMUNITY_DETAIL(id);
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">감사 로그</h1>
          <p className="text-sm text-gray-500 mt-1">회원, 공고, 지원, 광고 운영 관련 주요 변경 이력을 추적합니다.</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <label className="text-xs font-bold text-gray-500">테이블</label>
        <select
          value={tableFilter}
          onChange={(e) => { setTableFilter(e.target.value); setPage(1); }}
          className="px-2.5 h-8 rounded border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:border-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
        >
          {TABLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <label className="text-xs font-bold text-gray-500 ml-2">액션</label>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-2.5 h-8 rounded border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:border-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
        >
          {ACTION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <input
          type="text"
          value={recordIdFilter}
          onChange={(e) => { setRecordIdFilter(e.target.value); setPage(1); }}
          placeholder="레코드 ID로 검색"
          className="flex-1 min-w-[200px] h-8 px-2.5 rounded border border-gray-300 bg-white text-xs font-mono text-gray-700 hover:border-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
        />
      </div>

      {/* 리스트 */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded border border-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100"
          >
            다시 시도
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          로그가 없습니다.
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider w-44">시각</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider w-20">액션</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider w-24">테이블</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">레코드</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider w-44">변경자</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">변경 컬럼</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const recordLink = linkForRecord(row.table_name, row.record_id);
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-600 tabular-nums">
                      {new Date(row.changed_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded text-[10px] px-1.5 py-0.5 font-bold border ${ACTION_TONES[row.action]}`}>
                        {ACTION_LABELS[row.action]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink font-semibold">
                      {TABLE_LABELS[row.table_name] ?? row.table_name}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-600">
                      {recordLink ? (
                        <Link href={recordLink} className="hover:text-primary hover:underline">
                          {row.record_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span>{row.record_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700">
                      {row.changer ? (row.changer.company_name || row.changer.contact_name) : (
                        <span className="text-gray-400">시스템</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {row.changed_columns && row.changed_columns.length > 0 ? (
                        <span className="font-mono">
                          {row.changed_columns.slice(0, 3).join(', ')}
                          {row.changed_columns.length > 3 && <span className="text-gray-400"> +{row.changed_columns.length - 3}</span>}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="text-xs font-bold text-gray-500 hover:text-ink"
                      >
                        보기 →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">페이지 {page}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3 py-1.5 rounded border border-gray-300 hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed font-bold"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={rows.length < PAGE_SIZE || loading}
            className="px-3 py-1.5 rounded border border-gray-300 hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed font-bold"
          >
            다음
          </button>
        </div>
      </div>

      {/* 상세 패널 (drawer) */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-stretch justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
            <header className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-ink">감사 로그 상세</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(selected.changed_at).toLocaleString('ko-KR')} · {TABLE_LABELS[selected.table_name] ?? selected.table_name} · {ACTION_LABELS[selected.action]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="닫기"
                className="w-8 h-8 inline-flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
              >
                ×
              </button>
            </header>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="레코드 ID" value={selected.record_id} mono />
                <Field
                  label="변경자"
                  value={selected.changer ? (selected.changer.company_name || selected.changer.contact_name) : '시스템'}
                />
              </div>
              <h3 className="text-sm font-bold text-ink pt-2">변경 내역</h3>
              <AuditLogDiff
                action={selected.action}
                oldData={selected.old_data}
                newData={selected.new_data}
                changedColumns={selected.changed_columns}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm text-ink truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
