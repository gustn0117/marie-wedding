'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/features/admin/services/admin-service';
import { toast, toastConfirm } from '@/shared/components/Toast';
import type { ModerationKeyword, ModerationScope, ModerationAction } from '@/types/database';

const SCOPE_LABELS: Record<ModerationScope, string> = {
  job: '공고',
  post: '커뮤니티',
  comment: '댓글',
  all: '전체',
};

const ACTION_LABELS: Record<ModerationAction, string> = {
  hide: '자동 숨김',
  flag: '신고 큐로',
};

export default function ModerationKeywordsManager() {
  const [rows, setRows] = useState<ModerationKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [scope, setScope] = useState<ModerationScope>('all');
  const [action, setAction] = useState<ModerationAction>('hide');

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await adminService.getModerationKeywords());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '키워드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!keyword.trim()) { toast('키워드를 입력해 주세요.', 'error'); return; }
    setPending(true);
    try {
      const added = await adminService.addModerationKeyword(keyword.trim(), scope, action);
      setLoadError(null);
      setRows((current) => [added, ...current.filter((row) => row.id !== added.id)]);
      setKeyword('');
      toast('키워드를 추가했습니다.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '키워드 추가에 실패했습니다.', 'error');
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string, kw: string) {
    if (pending) return;
    const ok = await toastConfirm(`"${kw}" 키워드를 삭제하시겠습니까?`);
    if (!ok) return;
    const removed = rows.find((row) => row.id === id);
    setRows((current) => current.filter((row) => row.id !== id));
    setPending(true);
    try {
      await adminService.deleteModerationKeyword(id);
      toast('삭제되었습니다.', 'success');
    } catch (err) {
      if (removed) {
        setRows((current) => (
          current.some((row) => row.id === removed.id)
            ? current
            : [...current, removed].sort((a, b) => b.created_at.localeCompare(a.created_at))
        ));
      }
      toast(err instanceof Error ? err.message : '키워드 삭제에 실패했습니다.', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onAdd} className="platform-panel p-4 grid gap-2 sm:grid-cols-[1fr_140px_140px_auto]">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="자동 모더레이션 키워드"
          className="border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as ModerationScope)}
          className="border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          {Object.entries(SCOPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as ModerationAction)}
          className="border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-primary bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          추가
        </button>
      </form>

      <section className="platform-panel">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">등록된 키워드 ({rows.length})</h2>
        </div>
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">불러오는 중…</p>
        ) : loadError ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-rose-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary"
            >
              다시 시도
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">등록된 키워드가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{r.keyword}</p>
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded">
                    {SCOPE_LABELS[r.scope]}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded">
                    {ACTION_LABELS[r.action]}
                  </span>
                </div>
                <button
                  onClick={() => onDelete(r.id, r.keyword)}
                  disabled={pending}
                  className="text-xs text-gray-500 hover:text-state-urgent disabled:opacity-50"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
