'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { BUSINESS_TYPES, EMPLOYMENT_TYPES, REGIONS } from '@/shared/constants';

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
}

function fmt(iso: string | null) {
  if (!iso) return '-';
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const EMPTY = {
  companyName: '', contact: '', consentNote: '',
  title: '', description: '', businessType: '', employmentType: '', region: '', salaryInfo: '',
};

export default function AdminProxyJobsClient() {
  const [items, setItems] = useState<ProxyJob[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
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
  useEffect(() => { load(search); }, [search, load]);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/proxy-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'create', ...form }),
      }, 30000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '등록 실패');
      toast(`등록했습니다. 업체 전달 코드: ${b.claimCode}`, 'success');
      setOpen(false);
      setForm({ ...EMPTY });
      load(search);
    } catch (e) {
      toast(e instanceof Error ? e.message : '등록에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async (id: string) => {
    const res = await apiFetch('/api/admin/proxy-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'regenerate-code', id }),
    }, 12000);
    const b = await res.json().catch(() => ({}));
    if (res.ok) { toast(`새 코드: ${b.claimCode}`, 'success'); load(search); }
    else toast(b.error || '재발급 실패', 'error');
  };

  const assign = async (id: string) => {
    const profileId = prompt('넘길 업체의 프로필 ID를 입력하세요.');
    if (!profileId) return;
    const res = await apiFetch('/api/admin/proxy-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'assign', id, profileId: profileId.trim() }),
    }, 12000);
    const b = await res.json().catch(() => ({}));
    if (res.ok) { toast('업체 계정으로 넘겼습니다.', 'success'); load(search); }
    else toast(b.error || '이관 실패', 'error');
  };

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">대행 등록 공고</h1>
          <p className="mt-0.5 text-xs text-gray-500">업체 동의를 받아 대신 올린 공고 · 코드로 업체에게 넘김</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm">＋ 대행 공고 등록</button>
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
      {!loading && <p className="px-1 text-[11px] text-gray-400">전체 {count}건</p>}

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
                {!j.author_id && (
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => regenerate(j.id)}
                      className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">코드 재발급</button>
                    <button type="button" onClick={() => assign(j.id)}
                      className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">직접 이관</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setOpen(false); }}>
          <div className="my-6 w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-ink">대행 공고 등록</h3>
            <p className="mt-1 text-xs text-gray-500">업체 동의를 받은 공고만 등록하세요.</p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="업체명 *"><input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} className="input-field" placeholder="예) 강남 OO웨딩홀" /></Field>
                <Field label="업체 연락처 *"><input value={form.contact} onChange={(e) => set('contact', e.target.value)} className="input-field" placeholder="예) 02-000-0000 / 담당 김실장" /></Field>
              </div>
              <Field label="동의를 받은 경위 * (법적 근거로 남습니다)">
                <textarea value={form.consentNote} onChange={(e) => set('consentNote', e.target.value)} rows={2}
                  className="input-field" placeholder="예) 2026-07-26 전화 통화, 예약실 김○○ 실장이 공고 대신 등록에 동의" />
              </Field>

              <Field label="공고 제목 *"><input value={form.title} onChange={(e) => set('title', e.target.value)} className="input-field" placeholder="예) 예약실 상담 매니저 채용" /></Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="업종 *">
                  <select value={form.businessType} onChange={(e) => set('businessType', e.target.value)} className="input-field">
                    <option value="">선택</option>
                    {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </Field>
                <Field label="고용형태 *">
                  <select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)} className="input-field">
                    <option value="">선택</option>
                    {EMPLOYMENT_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </Field>
                <Field label="지역 *">
                  <select value={form.region} onChange={(e) => set('region', e.target.value)} className="input-field">
                    <option value="">선택</option>
                    {REGIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="급여 (선택)"><input value={form.salaryInfo} onChange={(e) => set('salaryInfo', e.target.value)} className="input-field" placeholder="예) 월 260만원 (협의)" /></Field>

              <Field label="공고 내용 *">
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={8}
                  className="input-field font-mono text-[12px]"
                  placeholder={'<h3>담당 업무</h3><ul><li>예식 상담</li></ul>\n<h3>지원 자격</h3><ul><li>경력 무관</li></ul>'} />
              </Field>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={saving}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">취소</button>
              <button type="button" onClick={submit} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
                {saving ? '등록 중…' : '등록하고 코드 발급'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
