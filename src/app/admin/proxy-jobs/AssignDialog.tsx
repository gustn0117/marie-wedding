'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { BUSINESS_TYPES, REGIONS } from '@/shared/constants';

interface Candidate {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  region: string | null;
  business_type: string | null;
  created_at: string;
}

interface AssignDialogProps {
  jobId: string;
  jobTitle: string;
  /** 대행 등록 때 적어둔 업체명 — 같은 이름을 위로 올려 오지정을 줄인다 */
  proxyCompanyName: string | null;
  onClose: () => void;
  onDone: () => void;
}

const label = (list: readonly { value: string; label: string }[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? null;

/** 비교용 정규화 — 공백·괄호·「(주)」 같은 표기 차이를 무시하고 이름을 맞춘다. */
function normalizeName(v: string | null): string {
  return (v ?? '').replace(/\(주\)|주식회사|\s|·|\-/g, '').toLowerCase();
}

export default function AssignDialog({
  jobId, jobTitle, proxyCompanyName, onClose, onDone,
}: AssignDialogProps) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ candidates: '1' });
      if (q) params.set('q', q);
      const res = await apiFetch(`/api/admin/proxy-jobs?${params.toString()}`, { credentials: 'include' }, 12000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '업체 목록을 불러오지 못했습니다.');
      setItems((b.items ?? []) as Candidate[]);
    } catch (e) {
      toast(e instanceof Error ? e.message : '업체 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => { load(search); }, [search, load]);

  // 대행 등록 때 적은 업체명과 같은 곳을 맨 위로
  const sorted = useMemo(() => {
    const target = normalizeName(proxyCompanyName);
    if (!target) return items;
    const score = (c: Candidate) => {
      const n = normalizeName(c.company_name);
      if (!n) return 0;
      if (n === target) return 2;
      if (n.includes(target) || target.includes(n)) return 1;
      return 0;
    };
    return [...items].sort((a, b) => score(b) - score(a));
  }, [items, proxyCompanyName]);

  const isLikely = (c: Candidate) => {
    const t = normalizeName(proxyCompanyName);
    const n = normalizeName(c.company_name);
    return !!t && !!n && (n === t || n.includes(t) || t.includes(n));
  };

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/proxy-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'assign', id: jobId, profileId: selected.id }),
      }, 15000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '이관에 실패했습니다.');
      toast(`${selected.company_name || selected.contact_name} 계정으로 넘겼습니다.`, 'success');
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : '이관에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="공고를 넘길 업체 선택"
    >
      <div className="my-6 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-ink">공고를 넘길 업체 선택</h3>
        <p className="mt-1 truncate text-xs text-gray-500">{jobTitle}</p>
        {proxyCompanyName && (
          <p className="mt-1 text-xs text-gray-500">
            대행 등록 시 적은 업체명: <b className="text-gray-700">{proxyCompanyName}</b>
          </p>
        )}

        <div className="relative mt-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="업체명·담당자로 찾기"
            autoFocus
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="mt-3 max-h-[320px] overflow-y-auto rounded border border-gray-200">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-400">불러오는 중…</p>
          ) : sorted.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-bold text-gray-700">가입한 업체 회원이 없습니다</p>
              <p className="mt-1 text-xs text-gray-500">
                업체가 먼저 가입해야 넘길 수 있습니다. 가입 전이라면 발급된 코드를 전달해주세요.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sorted.map((c) => {
                const on = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors ${on ? 'bg-primary-50/60' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="radio"
                        name="assign-target"
                        checked={on}
                        onChange={() => setSelected(c)}
                        className="mt-1 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-ink">
                            {c.company_name || c.contact_name || '이름 없음'}
                          </span>
                          {isLikely(c) && (
                            <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                              이름 일치
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-gray-500">
                          {[c.contact_name, label(BUSINESS_TYPES, c.business_type), label(REGIONS, c.region)]
                            .filter(Boolean).join(' · ') || '추가 정보 없음'}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <b>{selected.company_name || selected.contact_name}</b> 계정으로 넘깁니다.
            넘긴 뒤에는 그 업체가 공고의 주인이 되고 발급된 코드는 무효가 됩니다. 되돌리려면 업체에 요청해야 합니다.
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            취소
          </button>
          <button type="button" onClick={submit} disabled={!selected || saving}
            className="btn-primary text-sm disabled:opacity-50">
            {saving ? '넘기는 중…' : '이 업체로 넘기기'}
          </button>
        </div>
      </div>
    </div>
  );
}
