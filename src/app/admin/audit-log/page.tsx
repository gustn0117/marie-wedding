'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants';
import AuditLogDiff from '@/features/admin/components/AuditLogDiff';
import { useAuth } from '@/shared/hooks/useAuth';

interface AuditRow {
  id: number;
  table_name: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  changed_by: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_columns: string[] | null;
  changed_at: string;
  changer?: { id: string; company_name: string | null; contact_name: string; profile_image: string | null } | null;
}

const TABLE_LABELS: Record<string, string> = {
  quotations: '견적',
  contracts: '계약',
  bookings: '예약',
  settlements: '정산',
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

export default function AdminAuditLogPage() {
  useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('audit_log')
        .select('*, changer:profiles!changed_by(id, company_name, contact_name, profile_image)')
        .order('changed_at', { ascending: false })
        .range(from, to);

      if (tableFilter) query = query.eq('table_name', tableFilter);
      if (actionFilter) query = query.eq('action', actionFilter);
      if (recordIdFilter && recordIdFilter.length >= 8) query = query.eq('record_id', recordIdFilter.trim());

      const { data, error: e } = await query;
      if (e) throw e;
      setRows((data ?? []) as AuditRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [tableFilter, actionFilter, recordIdFilter, page]);

  useEffect(() => { load(); }, [load]);

  const linkForRecord = (table: string, id: string) => {
    switch (table) {
      case 'quotations': return ROUTES.QUOTATIONS_DETAIL(id);
      case 'contracts': return ROUTES.CONTRACTS_DETAIL(id);
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">감사 로그</h1>
          <p className="text-sm text-gray-500 mt-1">모든 거래 변경 이력을 추적합니다 (견적·계약·예약·정산).</p>
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
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
