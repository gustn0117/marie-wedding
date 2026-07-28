'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import AssignDialog from './AssignDialog';

interface ProxyJob {
  id: string;
  title: string;
  region: string;
  business_type: string;
  employment_type: string;
  proxy_company_name: string | null;
  proxy_contact: string | null;
  proxy_consent_note: string | null;
  proxy_consent_at: string | null;
  claim_code: string | null;
  claimed_at: string | null;
  author_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

function fmt(iso: string | null) {
  if (!iso) return '-';
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export default function AdminProxyJobsClient() {
  const [items, setItems] = useState<ProxyJob[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState('');
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  // 이관 대상 선택 다이얼로그 — 프로필 ID 를 손으로 입력하던 방식을 대체한다.
  const [assignTarget, setAssignTarget] = useState<ProxyJob | null>(null);

  const load = useCallback(async (q = '', deleted = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (deleted) params.set('showDeleted', '1');
      const res = await apiFetch(`/api/admin/proxy-jobs?${params.toString()}`, { credentials: 'include' }, 12000);
      if (!res.ok) throw new Error();
      const b = await res.json();
      setItems((b.items ?? []) as ProxyJob[]);
      setCount(b.count ?? 0);
    } catch {
      toast('목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(queryInput.trim()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);
  useEffect(() => { load(search, showDeleted); }, [search, showDeleted, load]);

  const regenerate = async (id: string) => {
    const res = await apiFetch('/api/admin/proxy-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'regenerate-code', id }),
    }, 12000);
    const b = await res.json().catch(() => ({}));
    if (res.ok) { toast(`새 코드: ${b.claimCode}`, 'success'); load(search, showDeleted); }
    else toast(b.error || '재발급 실패', 'error');
  };


  const remove = async (j: ProxyJob) => {
    const warn = j.author_id
      ? '이미 업체가 가져간 공고입니다. 삭제하면 그 업체 화면에서도 사라집니다. 삭제할까요?'
      : '이 대행 공고를 삭제할까요?';
    if (!confirm(warn)) return;
    const res = await apiFetch('/api/admin/proxy-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'delete', id: j.id }),
    }, 12000);
    const b = await res.json().catch(() => ({}));
    if (res.ok) { toast('삭제했습니다.', 'success'); load(search, showDeleted); }
    else toast(b.error || '삭제 실패', 'error');
  };

  const restore = async (j: ProxyJob) => {
    const res = await apiFetch('/api/admin/proxy-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'restore', id: j.id }),
    }, 12000);
    const b = await res.json().catch(() => ({}));
    if (res.ok) { toast('복구했습니다.', 'success'); load(search, showDeleted); }
    else toast(b.error || '복구 실패', 'error');
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">대행 등록 공고</h1>
          <p className="mt-0.5 text-xs text-gray-500">업체 동의를 받아 대신 올린 공고 · 코드로 업체에게 넘김</p>
        </div>
        <Link href="/admin/proxy-jobs/new" className="btn-primary text-sm">＋ 대행 공고 등록</Link>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
        <p className="font-bold">동의 없이 다른 사이트의 공고를 옮겨오면 안 됩니다.</p>
        <p className="mt-1">
          잡코리아·사람인 등의 공고를 무단으로 가져오는 것은 데이터베이스제작자 권리 침해입니다
          (서울고등법원, 잡코리아 대 사람인). 업체에 직접 동의를 받고 그 경위를 남겨주세요.
        </p>
      </div>

      <input
        type="search" value={queryInput} onChange={(e) => setQueryInput(e.target.value)}
        placeholder="업체명·공고 제목 검색"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <div className="flex items-center justify-between px-1">
        {!loading && <p className="text-[11px] text-gray-400">전체 {count}건</p>}
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          삭제된 공고도 보기
        </label>
      </div>

      <div className="platform-panel divide-y divide-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">대행 등록한 공고가 없습니다.</div>
        ) : items.map((j) => (
          <div key={j.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{j.proxy_company_name}</span>
                  {j.author_id
                    ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">이관 완료</span>
                    : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">미이관</span>}
                  {j.deleted_at && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">삭제됨</span>}
                </div>
                <p className="truncate text-sm text-gray-700">{j.title}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  연락처 {j.proxy_contact} · 등록 {fmt(j.created_at)}
                  {j.claimed_at ? ` · 이관 ${fmt(j.claimed_at)}` : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">동의 기록: {j.proxy_consent_note}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {!j.author_id && j.claim_code && (
                  <code className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-bold tracking-wider text-ink">
                    {j.claim_code}
                  </code>
                )}
                <div className="flex gap-1.5">
                  {!j.author_id && !j.deleted_at && (
                    <>
                      <button type="button" onClick={() => regenerate(j.id)}
                        className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">코드 재발급</button>
                      <button type="button" onClick={() => setAssignTarget(j)}
                        className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">직접 이관</button>
                    </>
                  )}
                  {!j.deleted_at && (
                    <Link href={`/admin/proxy-jobs/${j.id}/edit`}
                      className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">수정</Link>
                  )}
                  {j.deleted_at ? (
                    <button type="button" onClick={() => restore(j)}
                      className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">복구</button>
                  ) : (
                    <button type="button" onClick={() => remove(j)}
                      className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-500 hover:border-rose-400 hover:text-rose-500">삭제</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assignTarget && (
        <AssignDialog
          jobId={assignTarget.id}
          jobTitle={assignTarget.title}
          proxyCompanyName={assignTarget.proxy_company_name}
          onClose={() => setAssignTarget(null)}
          onDone={() => { setAssignTarget(null); load(search, showDeleted); }}
        />
      )}

    </div>
  );
}

