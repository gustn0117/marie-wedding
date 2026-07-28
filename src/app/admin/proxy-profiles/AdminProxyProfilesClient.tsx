'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { BUSINESS_TYPES, REGIONS } from '@/shared/constants';

interface ProxyProfile {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  business_type: string | null;
  region: string | null;
  proxy_contact: string | null;
  proxy_consent_note: string | null;
  is_directory_listed: boolean;
  created_at: string;
  deleted_at: string | null;
}

interface Candidate {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  region: string | null;
  business_type: string | null;
}

const EMPTY = {
  companyName: '', contactName: '', businessType: '', region: '',
  bio: '', address: '', website: '', companySize: '', establishedYear: '',
  proxyContact: '', consentNote: '',
};

const label = (list: readonly { value: string; label: string }[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? null;

function fmt(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

function normalizeName(v: string | null): string {
  return (v ?? '').replace(/\(주\)|주식회사|\s|·|-/g, '').toLowerCase();
}

export default function AdminProxyProfilesClient() {
  const [items, setItems] = useState<ProxyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState('');
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ProxyProfile | null>(null);

  const load = useCallback(async (q: string, deleted: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (deleted) params.set('showDeleted', '1');
      const res = await apiFetch(`/api/admin/proxy-profiles?${params.toString()}`, { credentials: 'include' }, 12000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '목록을 불러오지 못했습니다.');
      setItems((b.items ?? []) as ProxyProfile[]);
    } catch (e) {
      toast(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(queryInput.trim()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);
  useEffect(() => { load(search, showDeleted); }, [search, showDeleted, load]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const openCreate = () => { setEditingId(null); setForm({ ...EMPTY }); };

  const openEdit = async (p: ProxyProfile) => {
    const res = await apiFetch(`/api/admin/proxy-profiles?id=${encodeURIComponent(p.id)}`, { credentials: 'include' }, 12000);
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast(b.error || '불러오지 못했습니다.', 'error'); return; }
    const f = b.profile;
    setEditingId(p.id);
    setForm({
      companyName: f.company_name ?? '', contactName: f.contact_name ?? '',
      businessType: (f.business_type ?? '').split(',')[0] ?? '', region: (f.region ?? '').split(',')[0] ?? '',
      bio: f.bio ?? '', address: f.address ?? '', website: f.website ?? '',
      companySize: f.company_size ?? '', establishedYear: f.established_year ?? '',
      proxyContact: f.proxy_contact ?? '', consentNote: f.proxy_consent_note ?? '',
    });
  };

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/proxy-profiles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(editingId ? { action: 'update', id: editingId, ...form } : { action: 'create', ...form }),
      }, 20000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '저장에 실패했습니다.');
      toast(editingId ? '수정했습니다.' : '등록했습니다. 디렉토리에 바로 노출됩니다.', 'success');
      setForm(null); setEditingId(null);
      load(search, showDeleted);
    } catch (e) {
      toast(e instanceof Error ? e.message : '저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const act = async (action: 'delete' | 'restore', p: ProxyProfile) => {
    if (action === 'delete' && !confirm(`'${p.company_name}' 대행 프로필을 삭제할까요? 디렉토리에서 사라집니다.`)) return;
    const res = await apiFetch('/api/admin/proxy-profiles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action, id: p.id }),
    }, 12000);
    const b = await res.json().catch(() => ({}));
    if (res.ok) { toast(action === 'delete' ? '삭제했습니다.' : '복구했습니다.', 'success'); load(search, showDeleted); }
    else toast(b.error || '처리 실패', 'error');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">대행 등록 프로필</h1>
          <p className="mt-0.5 text-xs text-gray-500">업체 동의를 받아 대신 만든 디렉토리 등재 · 가입하면 그 계정으로 넘김</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary text-sm">＋ 대행 프로필 등록</button>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
        <p className="font-bold">업체 동의를 받은 곳만 등록하세요.</p>
        <p className="mt-1">
          동의 없이 다른 사이트의 업체 정보를 옮겨오면 데이터베이스제작자 권리 침해입니다.
          등록하면 디렉토리에 바로 공개되므로, 사실과 다른 정보가 올라가지 않도록 확인해주세요.
        </p>
      </div>

      <input
        type="search" value={queryInput} onChange={(e) => setQueryInput(e.target.value)}
        placeholder="업체명·담당자 검색"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <div className="flex items-center justify-between px-1">
        {!loading && <p className="text-[11px] text-gray-400">전체 {items.length}건</p>}
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          삭제된 것도 보기
        </label>
      </div>

      <div className="platform-panel divide-y divide-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">대행 등록한 프로필이 없습니다.</div>
        ) : items.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink">{p.company_name}</span>
                {p.deleted_at
                  ? <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">삭제됨</span>
                  : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">미이관</span>}
              </div>
              <p className="text-[12.5px] text-gray-600">
                {[p.contact_name, label(BUSINESS_TYPES, (p.business_type ?? '').split(',')[0]), label(REGIONS, (p.region ?? '').split(',')[0])]
                  .filter(Boolean).join(' · ')}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">연락처 {p.proxy_contact} · 등록 {fmt(p.created_at)}</p>
              <p className="mt-0.5 text-[11px] text-gray-500">동의 기록: {p.proxy_consent_note}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {!p.deleted_at && (
                <>
                  <a href={`/directory/${p.id}`} target="_blank" rel="noreferrer"
                    className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">보기</a>
                  <button type="button" onClick={() => openEdit(p)}
                    className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">수정</button>
                  <button type="button" onClick={() => setAssignTarget(p)}
                    className="rounded border border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary">업체에 넘기기</button>
                </>
              )}
              <button type="button" onClick={() => act(p.deleted_at ? 'restore' : 'delete', p)}
                className={`rounded border border-gray-300 px-2 py-1 text-[11px] font-bold ${p.deleted_at ? 'text-gray-600 hover:border-primary hover:text-primary' : 'text-gray-500 hover:border-rose-400 hover:text-rose-500'}`}>
                {p.deleted_at ? '복구' : '삭제'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <ProfileFormDialog
          form={form} set={set} saving={saving} editing={!!editingId}
          onClose={() => { setForm(null); setEditingId(null); }} onSubmit={submit}
        />
      )}

      {assignTarget && (
        <AssignProfileDialog
          proxy={assignTarget}
          onClose={() => setAssignTarget(null)}
          onDone={() => { setAssignTarget(null); load(search, showDeleted); }}
        />
      )}
    </div>
  );
}

function ProfileFormDialog({
  form, set, saving, editing, onClose, onSubmit,
}: {
  form: typeof EMPTY;
  set: (k: keyof typeof EMPTY, v: string) => void;
  saving: boolean; editing: boolean;
  onClose: () => void; onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="my-6 w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-ink">{editing ? '대행 프로필 수정' : '대행 프로필 등록'}</h3>
        <p className="mt-1 text-xs text-gray-500">디렉토리에 등재될 내용입니다. 업체가 가입하면 이 내용이 그 계정으로 넘어갑니다.</p>

        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="업체명 *"><input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} className="input-field" placeholder="예) 강남 OO웨딩홀" /></Field>
            <Field label="담당자명 *"><input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} className="input-field" placeholder="예) 김실장" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="업종 *">
              <select value={form.businessType} onChange={(e) => set('businessType', e.target.value)} className="input-field">
                <option value="">선택</option>
                {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </Field>
            <Field label="지역 *">
              <select value={form.region} onChange={(e) => set('region', e.target.value)} className="input-field">
                <option value="">선택</option>
                {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="소개">
            <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={4} className="input-field resize-y"
              placeholder="홀 규모, 예식 형태, 근무 분위기 등 구직자가 궁금해할 내용" />
            <p className="mt-1 text-[11px] text-gray-400">여기 적은 내용은 검색엔진에도 공개됩니다. 전화번호 같은 연락처는 넣지 마세요.</p>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="주소"><input value={form.address} onChange={(e) => set('address', e.target.value)} className="input-field" /></Field>
            <Field label="홈페이지"><input value={form.website} onChange={(e) => set('website', e.target.value)} className="input-field" placeholder="https://" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="규모"><input value={form.companySize} onChange={(e) => set('companySize', e.target.value)} className="input-field" placeholder="예) 직원 20명" /></Field>
            <Field label="설립연도"><input value={form.establishedYear} onChange={(e) => set('establishedYear', e.target.value)} className="input-field" placeholder="예) 2015" /></Field>
          </div>

          <div className="border-t border-gray-200 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="업체 연락처 * (관리자만 봄)"><input value={form.proxyContact} onChange={(e) => set('proxyContact', e.target.value)} className="input-field" placeholder="02-000-0000 / 김실장" /></Field>
              <Field label="동의를 받은 경위 * (법적 근거)"><input value={form.consentNote} onChange={(e) => set('consentNote', e.target.value)} className="input-field" placeholder="2026-07-27 전화 통화, 김실장 동의" /></Field>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">취소</button>
          <button type="button" onClick={onSubmit} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
            {saving ? '저장 중…' : editing ? '수정 저장' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignProfileDialog({
  proxy, onClose, onDone,
}: { proxy: ProxyProfile; onClose: () => void; onDone: () => void }) {
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
      const res = await apiFetch(`/api/admin/proxy-profiles?${params.toString()}`, { credentials: 'include' }, 12000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '업체 목록을 불러오지 못했습니다.');
      setItems((b.items ?? []) as Candidate[]);
    } catch (e) {
      toast(e instanceof Error ? e.message : '업체 목록을 불러오지 못했습니다.', 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const t = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(t); }, [query]);
  useEffect(() => { load(search); }, [search, load]);

  const sorted = useMemo(() => {
    const t = normalizeName(proxy.company_name);
    if (!t) return items;
    const score = (c: Candidate) => {
      const n = normalizeName(c.company_name);
      if (!n) return 0;
      if (n === t) return 2;
      return n.includes(t) || t.includes(n) ? 1 : 0;
    };
    return [...items].sort((a, b) => score(b) - score(a));
  }, [items, proxy.company_name]);

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/proxy-profiles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'assign', id: proxy.id, profileId: selected.id }),
      }, 20000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '이관에 실패했습니다.');
      const n = (b.filled ?? []).length;
      toast(n > 0 ? `${selected.company_name || selected.contact_name} 프로필에 ${n}개 항목을 옮겼습니다.` : '옮길 빈 항목이 없어 등재만 켰습니다.', 'success');
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : '이관에 실패했습니다.', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
      role="dialog" aria-modal="true" aria-label="프로필을 넘길 업체 선택">
      <div className="my-6 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-ink">프로필을 넘길 업체 선택</h3>
        <p className="mt-1 text-xs text-gray-500">
          대행 프로필: <b className="text-gray-700">{proxy.company_name}</b>
        </p>

        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          placeholder="업체명·담당자로 찾기"
          className="mt-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none" />

        <div className="mt-3 max-h-[300px] overflow-y-auto rounded border border-gray-200">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-400">불러오는 중…</p>
          ) : sorted.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-bold text-gray-700">가입한 업체 회원이 없습니다</p>
              <p className="mt-1 text-xs text-gray-500">업체가 먼저 가입해야 넘길 수 있습니다.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sorted.map((c) => {
                const on = selected?.id === c.id;
                const likely = normalizeName(c.company_name) && normalizeName(proxy.company_name)
                  && normalizeName(c.company_name).includes(normalizeName(proxy.company_name));
                return (
                  <li key={c.id}>
                    <label className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 ${on ? 'bg-primary-50/60' : 'hover:bg-gray-50'}`}>
                      <input type="radio" name="assign-profile" checked={on} onChange={() => setSelected(c)} className="mt-1 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-ink">{c.company_name || c.contact_name || '이름 없음'}</span>
                          {likely && <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">이름 일치</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-gray-500">
                          {[c.contact_name, label(BUSINESS_TYPES, (c.business_type ?? '').split(',')[0]), label(REGIONS, (c.region ?? '').split(',')[0])].filter(Boolean).join(' · ')}
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
            <b>{selected.company_name || selected.contact_name}</b> 프로필의 <b>비어 있는 항목만</b> 채웁니다.
            업체가 이미 적어둔 내용은 그대로 둡니다. 옮긴 뒤 이 대행 프로필은 삭제되고 디렉토리에서 사라집니다.
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">취소</button>
          <button type="button" onClick={submit} disabled={!selected || saving} className="btn-primary text-sm disabled:opacity-50">
            {saving ? '옮기는 중…' : '이 업체로 넘기기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-500">{l}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
