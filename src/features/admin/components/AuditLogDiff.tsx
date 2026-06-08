'use client';

import { useMemo } from 'react';

type JsonRecord = Record<string, unknown> | null | undefined;

interface DiffRow {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changed: boolean;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') {
    if (v.length === 0) return '""';
    if (v.length > 200) return v.slice(0, 200) + '…';
    return v;
  }
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

const SKIP_KEYS = ['updated_at', 'created_at'];

export default function AuditLogDiff({
  action,
  oldData,
  newData,
  changedColumns,
}: {
  action: 'insert' | 'update' | 'delete';
  oldData: JsonRecord;
  newData: JsonRecord;
  changedColumns: string[] | null;
}) {
  const rows = useMemo<DiffRow[]>(() => {
    const allKeys = new Set<string>();
    if (oldData) Object.keys(oldData).forEach((k) => allKeys.add(k));
    if (newData) Object.keys(newData).forEach((k) => allKeys.add(k));
    const list: DiffRow[] = [];
    for (const key of Array.from(allKeys).sort()) {
      if (SKIP_KEYS.includes(key)) continue;
      const ov = oldData?.[key];
      const nv = newData?.[key];
      const changed = changedColumns?.includes(key) ?? (JSON.stringify(ov) !== JSON.stringify(nv));
      // delete는 항상 표시, insert는 비-null 만, update는 changed 우선
      if (action === 'update' && !changed) continue;
      if (action === 'insert' && (nv === null || nv === undefined)) continue;
      list.push({ key, oldValue: ov, newValue: nv, changed });
    }
    return list;
  }, [action, oldData, newData, changedColumns]);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">변경된 필드가 없습니다.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider w-44">필드</th>
            {action !== 'insert' && (
              <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">변경 전</th>
            )}
            {action !== 'delete' && (
              <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">변경 후</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => (
            <tr key={row.key} className={row.changed ? '' : 'opacity-60'}>
              <td className="px-3 py-2 align-top font-mono text-[11px] text-gray-700">{row.key}</td>
              {action !== 'insert' && (
                <td className="px-3 py-2 align-top">
                  <code className="text-[11px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded break-all">
                    {formatValue(row.oldValue)}
                  </code>
                </td>
              )}
              {action !== 'delete' && (
                <td className="px-3 py-2 align-top">
                  <code className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded break-all">
                    {formatValue(row.newValue)}
                  </code>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
