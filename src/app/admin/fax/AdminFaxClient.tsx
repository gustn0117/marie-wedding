'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';

interface FaxRow {
  id: string;
  to_number: string;
  subject: string | null;
  file_path: string | null;
  page_count: number;
  status: 'queued' | 'sent' | 'failed';
  provider: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

interface OptoutRow { number: string; reason: string | null; created_at: string }

function fmt(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function normalize(raw: string) { return raw.replace(/[^0-9]/g, ''); }
function prettyNumber(n: string) {
  const v = normalize(n);
  if (v.length >= 9 && v.startsWith('02')) return `${v.slice(0, 2)}-${v.slice(2, -4)}-${v.slice(-4)}`;
  if (v.length >= 10) return `${v.slice(0, 3)}-${v.slice(3, -4)}-${v.slice(-4)}`;
  return v;
}
function isValid(raw: string) {
  const v = normalize(raw);
  return v.length >= 9 && v.length <= 11 && v.startsWith('0');
}

/** 쉼표·세미콜론·줄바꿈으로 나눈 수신처 목록(중복 제거) */
function parseNumbers(raw: string): string[] {
  const list = raw.split(/[\n,;]+/).map((s) => normalize(s)).filter((s) => isValid(s));
  return Array.from(new Set(list));
}

// 발송 가능 시간(08:00~21:00 KST) — 서버에서도 강제하지만 화면에서 미리 알려준다.
function withinWindow(): boolean {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(new Date()));
  return h >= 8 && h < 21;
}

export default function AdminFaxClient() {
  const [items, setItems] = useState<FaxRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [search, setSearch] = useState('');
  const [compose, setCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [sentMap, setSentMap] = useState<Record<string, { at: string; count: number }>>({});
  const [optouts, setOptouts] = useState<OptoutRow[]>([]);
  const [showOptout, setShowOptout] = useState(false);

  // 작성 상태
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [doc, setDoc] = useState<{ url: string; path: string; kind: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q = '', p = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set('q', q);
      const res = await apiFetch(`/api/admin/fax?${params.toString()}`, { credentials: 'include' }, 12000);
      if (!res.ok) throw new Error();
      const body = await res.json();
      const next = (body.items ?? []) as FaxRow[];
      setItems((prev) => {
        if (!append) return next;
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...next.filter((x) => !seen.has(x.id))];
      });
      setCount(body.count ?? 0);
      setPage(p);
    } catch {
      toast('발송 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(queryInput.trim()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => { load(search, 1); }, [search, load]);

  const loadOptouts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/fax?optout=1', { credentials: 'include' }, 12000);
      if (!res.ok) return;
      const b = await res.json();
      setOptouts((b.items ?? []) as OptoutRow[]);
    } catch { /* noop */ }
  }, []);

  const loadSent = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/fax?recipients=1', { credentials: 'include' }, 12000);
      if (!res.ok) return;
      const b = await res.json();
      setSentMap(b.recipients ?? {});
    } catch { /* noop */ }
  }, []);

  const openCompose = (preset?: Partial<{ to: string; subject: string }>) => {
    setTo(preset?.to ?? '');
    setSubject(preset?.subject ?? '');
    setDoc(null);
    setCompose(true);
    loadSent();
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/admin/fax/upload', { method: 'POST', body: fd, credentials: 'include' }, 60000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '업로드 실패');
      setDoc({ url: b.url, path: b.path, kind: b.kind, name: file.name });
    } catch (e) {
      toast(e instanceof Error ? e.message : '문서 업로드에 실패했습니다.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    const numbers = parseNumbers(to);
    if (numbers.length === 0) { toast('받는 팩스번호를 입력해주세요.', 'error'); return; }
    if (!subject.trim()) { toast('제목을 입력해주세요.', 'error'); return; }
    if (!doc) { toast('보낼 문서를 첨부해주세요.', 'error'); return; }
    if (!withinWindow()) { toast('광고 팩스는 오전 8시~오후 9시에만 보낼 수 있습니다.', 'error'); return; }
    if (numbers.length > 1 && !confirm(`${numbers.length}곳에 같은 문서를 각각 발송합니다. 계속할까요?`)) return;

    setSending(true);
    setProgress({ done: 0, total: numbers.length });
    let ok = 0;
    const failed: string[] = [];
    try {
      for (let i = 0; i < numbers.length; i += 1) {
        setProgress({ done: i, total: numbers.length });
        try {
          const res = await apiFetch('/api/admin/fax', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ action: 'send', to: numbers[i], subject, fileUrl: doc.url, filePath: doc.path }),
          }, 60000);
          const b = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(b.error || '발송 실패');
          ok += 1;
        } catch {
          failed.push(numbers[i]);
        }
      }
      if (failed.length === 0) toast(numbers.length === 1 ? '팩스를 발송했습니다.' : `${ok}곳에 발송했습니다.`, 'success');
      else toast(`${ok}곳 발송 · ${failed.length}곳 실패`, 'error');
      if (ok > 0) setCompose(false);
      load(search, 1);
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const addOptout = async (number: string) => {
    const n = normalize(number);
    if (!n) return;
    const res = await apiFetch('/api/admin/fax', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'optout-add', number: n, reason: '관리자 등록' }),
    }, 10000);
    if (res.ok) { toast('수신거부로 등록했습니다.', 'success'); loadOptouts(); }
    else toast('등록에 실패했습니다.', 'error');
  };

  const removeOptout = async (number: string) => {
    const res = await apiFetch('/api/admin/fax', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'optout-remove', number }),
    }, 10000);
    if (res.ok) { toast('수신거부를 해제했습니다.', 'success'); loadOptouts(); }
    else toast('해제에 실패했습니다.', 'error');
  };

  const remove = async (row: FaxRow) => {
    if (!confirm('이 발송 기록을 삭제할까요?')) return;
    setItems((prev) => prev.filter((x) => x.id !== row.id));
    setCount((c) => Math.max(0, c - 1));
    const res = await apiFetch('/api/admin/fax', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'delete', id: row.id }),
    }, 8000);
    if (!res.ok) { toast('삭제에 실패했습니다.', 'error'); load(search, 1); }
  };

  const dup = parseNumbers(to).map((n) => ({ n, info: sentMap[n] })).filter((x) => !!x.info);
  const blocked = parseNumbers(to).filter((n) => optouts.some((o) => o.number === n));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">팩스</h1>
          <p className="mt-0.5 text-xs text-gray-500">웨딩홀 대상 문서 발송 · 발송 이력과 수신거부 관리</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setShowOptout((v) => !v); loadOptouts(); }}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary">
            수신거부 목록
          </button>
          <button type="button" onClick={() => openCompose()} className="btn-primary text-sm">＋ 팩스 보내기</button>
        </div>
      </div>

      {/* 공급자 미연결 안내 */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <p className="font-bold">팩스 공급자가 아직 연결되지 않았습니다.</p>
        <p className="mt-1 leading-relaxed">
          화면·이력·수신거부·시간 제한은 모두 동작합니다. 솔라피 또는 팝빌 API 키를 발급받아
          <code className="mx-1 rounded bg-amber-100 px-1">FAX_PROVIDER</code>와 키를 설정하면 실제 발송이 켜집니다.
        </p>
      </div>

      {showOptout && (
        <div className="platform-panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">수신거부 번호 {optouts.length}건</h2>
            <button type="button" onClick={() => { const v = prompt('수신거부로 등록할 팩스번호'); if (v) addOptout(v); }}
              className="rounded border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-600 hover:border-primary hover:text-primary">
              번호 추가
            </button>
          </div>
          {optouts.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">등록된 수신거부 번호가 없습니다.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {optouts.map((o) => (
                <li key={o.number} className="flex items-center justify-between py-2 text-xs">
                  <span className="font-semibold text-gray-800">{prettyNumber(o.number)}</span>
                  <span className="text-gray-400">{o.reason} · {fmt(o.created_at)}</span>
                  <button type="button" onClick={() => removeOptout(o.number)} className="text-gray-400 hover:text-rose-500">해제</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <input type="search" value={queryInput} onChange={(e) => setQueryInput(e.target.value)}
          placeholder="팩스번호·제목 검색"
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm focus:border-primary focus:outline-none" />
      </div>
      {!loading && <p className="px-1 text-[11px] text-gray-400">{search ? `'${search}' 검색 결과 ${count}건` : `전체 ${count}건`}</p>}

      {/* 이력 */}
      <div className="platform-panel divide-y divide-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">{search ? '검색 결과가 없습니다.' : '발송 이력이 없습니다.'}</div>
        ) : items.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">{prettyNumber(row.to_number)}</span>
                {row.status === 'sent'
                  ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">발송</span>
                  : row.status === 'failed'
                    ? <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">실패</span>
                    : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">대기</span>}
              </div>
              <p className="truncate text-sm text-gray-600">{row.subject || '(제목 없음)'}</p>
              <p className="text-[11px] text-gray-400">
                {fmt(row.created_at)} · {row.page_count}장{row.provider ? ` · ${row.provider}` : ''}
                {row.error ? ` · ${row.error}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button type="button" onClick={() => openCompose({ to: row.to_number, subject: row.subject ?? '' })}
                className="rounded border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-600 hover:border-primary hover:text-primary">다시 보내기</button>
              <button type="button" onClick={() => addOptout(row.to_number)}
                className="rounded border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-500 hover:border-amber-400 hover:text-amber-600">수신거부</button>
              <button type="button" onClick={() => remove(row)}
                className="rounded border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-500 hover:border-rose-400 hover:text-rose-500">삭제</button>
            </div>
          </div>
        ))}
        {!loading && items.length < count && (
          <button type="button" onClick={() => load(search, page + 1, true)} disabled={loadingMore}
            className="w-full px-4 py-3 text-center text-xs font-bold text-gray-500 hover:bg-gray-50 hover:text-primary disabled:opacity-50">
            {loadingMore ? '불러오는 중…' : `더 보기 (${items.length}/${count})`}
          </button>
        )}
      </div>

      {/* 작성 모달 */}
      {compose && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) setCompose(false); }}>
          <div className="my-6 w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-ink">팩스 보내기</h3>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500">받는 팩스번호</label>
                <textarea value={to} onChange={(e) => setTo(e.target.value)} rows={2}
                  placeholder="02-708-4012 — 여러 곳은 쉼표 또는 줄바꿈으로 구분"
                  className="mt-1 w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                {parseNumbers(to).length > 1 && <p className="mt-1 text-[11px] font-bold text-primary">{parseNumbers(to).length}곳</p>}
                {blocked.length > 0 && (
                  <p className="mt-1 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">
                    수신거부 번호 {blocked.length}곳이 포함돼 있습니다 — 해당 번호는 발송되지 않습니다.
                  </p>
                )}
                {dup.length > 0 && (
                  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <p className="font-bold">이미 보낸 곳 {dup.length}곳 — 중복 발송 주의</p>
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {dup.slice(0, 6).map((x) => (
                        <li key={x.n}>{prettyNumber(x.n)} · 마지막 {fmt(x.info!.at)}{x.info!.count > 1 ? ` (${x.info!.count}회)` : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500">제목</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="예) 마리에 웨딩홀 채용 서비스 안내"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500">보낼 문서 (PDF 또는 이미지)</label>
                {doc ? (
                  <div className="mt-1 flex items-center justify-between rounded border border-gray-300 px-3 py-2 text-sm">
                    <span className="truncate text-gray-700">{doc.name} <span className="text-gray-400">({doc.kind.toUpperCase()})</span></span>
                    <button type="button" onClick={() => setDoc(null)} className="shrink-0 text-xs font-bold text-gray-400 hover:text-rose-500">삭제</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="mt-1 w-full rounded border border-dashed border-gray-300 px-3 py-4 text-sm font-semibold text-gray-500 hover:border-primary hover:text-primary disabled:opacity-50">
                    {uploading ? '올리는 중…' : '문서 선택 (PDF · JPG · PNG, 15MB 이하)'}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
                광고 팩스는 <b>오전 8시~오후 9시</b>에만 발송됩니다. 표지에 (광고) 표기와 수신거부 안내가 들어가야 하며,
                수신거부로 등록된 번호는 자동으로 차단됩니다.
                {!withinWindow() && <span className="mt-1 block font-bold text-rose-600">지금은 발송 가능 시간이 아닙니다.</span>}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCompose(false)} disabled={sending}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">취소</button>
              <button type="button" onClick={send} disabled={sending || uploading} className="btn-primary text-sm disabled:opacity-50">
                {sending
                  ? (progress && progress.total > 1 ? `발송 중… ${progress.done}/${progress.total}` : '발송 중…')
                  : (parseNumbers(to).length > 1 ? `${parseNumbers(to).length}곳 발송` : '발송')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
