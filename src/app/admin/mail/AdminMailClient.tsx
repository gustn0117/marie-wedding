'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { usePendingUploads } from '@/shared/hooks/usePendingUploads';

interface Mail {
  id: string;
  direction: 'inbound' | 'outbound';
  from_addr: string;
  to_addr: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  read_at: string | null;
  opened_at: string | null;
  open_count: number;
  created_at: string;
}

type Folder = 'inbound' | 'outbound';

function fmt(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// from/to 헤더에서 이메일 주소만 추출("이름 <a@b.com>" → "a@b.com")
function addrOnly(v: string): string {
  const m = v.match(/<([^>]+)>/);
  return (m ? m[1] : v).trim();
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 에디터 HTML 이 실질적으로 비어있는지(텍스트/이미지 없음) 검사
function htmlIsEmpty(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length === 0;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 여러 수신자 입력(쉼표/세미콜론/줄바꿈 구분) → 유효 이메일 목록(중복 제거).
function parseRecipients(raw: string): string[] {
  const list = raw
    .split(/[\n,;]+/)
    .map((s) => addrOnly(s.trim()))
    .filter((s) => EMAIL_RE.test(s));
  return Array.from(new Set(list));
}

interface Compose { to: string; subject: string; mode: 'rich' | 'html'; html: string; inReplyTo: string | null; }

interface Bounce { at: string; from: string; subject: string | null; snippet: string; }
interface Delivery { id: string; opened_at: string | null; open_count: number; bounce: Bounce | null; }

export default function AdminMailClient() {
  const [folder, setFolder] = useState<Folder>('inbound');
  const [items, setItems] = useState<Mail[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Mail | null>(null);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ done: number; total: number } | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [checking, setChecking] = useState(false);
  const { trackUpload, waitForUploads, pendingCount } = usePendingUploads();
  // 최신 본문 HTML — 이미지 업로드 완료가 onChange 로 반영되기 전 발송 눌러도 최신값을 쓴다.
  const htmlRef = useRef('');

  const load = useCallback(async (f: Folder) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/mail?folder=${f}`, { credentials: 'include' }, 12000);
      if (!res.ok) throw new Error();
      const body = await res.json();
      setItems((body.items ?? []) as Mail[]);
      setUnread(body.unread ?? 0);
    } catch {
      toast('메일을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(folder); setSelected(null); setDelivery(null); }, [folder, load]);

  // 보낸 메일 전달 상태(열람/반송) 확인. silent=true 면 토스트 없이 조용히 갱신.
  const checkStatus = useCallback(async (id: string, silent = false) => {
    setChecking(true);
    try {
      const res = await apiFetch('/api/admin/mail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'status', id }),
      }, 12000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '상태를 확인하지 못했습니다.');
      const opened = b.opened_at ?? null;
      const count = b.open_count ?? 0;
      const bounce = (b.bounce ?? null) as Bounce | null;
      setDelivery({ id, opened_at: opened, open_count: count, bounce });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, opened_at: opened ?? x.opened_at, open_count: count || x.open_count } : x)));
      setSelected((prev) => (prev && prev.id === id ? { ...prev, opened_at: opened ?? prev.opened_at, open_count: count || prev.open_count } : prev));
      if (!silent) {
        if (bounce) toast('전달 실패(반송)가 감지됐어요. 받는 주소를 확인해주세요.', 'error');
        else if (opened) toast('상대가 메일을 받아 열람했습니다.', 'success');
        else toast('전달 접수 상태입니다. 아직 열람 전이에요.', 'info');
      }
    } catch (e) {
      if (!silent) toast(e instanceof Error ? e.message : '상태 확인에 실패했습니다.', 'error');
    } finally {
      setChecking(false);
    }
  }, []);

  const openMail = async (m: Mail) => {
    setSelected(m);
    setDelivery(null);
    if (m.direction === 'outbound') checkStatus(m.id, true);
    if (m.direction === 'inbound' && !m.read_at) {
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      apiFetch('/api/admin/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'read', id: m.id }) }, 8000).catch(() => {});
    }
  };

  const remove = async (m: Mail) => {
    if (!confirm('이 메일을 삭제할까요?')) return;
    setItems((prev) => prev.filter((x) => x.id !== m.id));
    if (selected?.id === m.id) setSelected(null);
    try {
      const res = await apiFetch('/api/admin/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'delete', id: m.id }) }, 8000);
      if (!res.ok) throw new Error();
    } catch { toast('삭제에 실패했습니다.', 'error'); load(folder); }
  };

  const send = async () => {
    if (!compose) return;
    const html = htmlRef.current || compose.html;
    const recipients = parseRecipients(compose.to);
    if (recipients.length === 0 || !compose.subject.trim() || htmlIsEmpty(html)) {
      toast('받는사람(1명 이상)·제목·내용을 모두 입력해주세요.', 'error');
      return;
    }
    if (recipients.length > 1 && !confirm(`${recipients.length}곳에 같은 메일을 각각 발송합니다. 계속할까요?`)) return;

    setSending(true);
    setSendProgress({ done: 0, total: recipients.length });
    try {
      // 본문에 넣은 사진 업로드가 끝날 때까지 대기(끝나면 최신 HTML 로 발송)
      await waitForUploads();
      // 소스 모드는 textarea 값을 그대로, 리치 모드는 업로드 반영된 최신 htmlRef 를 쓴다.
      const finalHtml = compose.mode === 'html' ? compose.html : (htmlRef.current || html);
      // 각 수신자에게 개별 발송(각자 별도 보낸편지함 사본 + 수신확인 추적). 순차 발송.
      let ok = 0;
      const failed: string[] = [];
      for (let i = 0; i < recipients.length; i += 1) {
        setSendProgress({ done: i, total: recipients.length });
        try {
          const res = await apiFetch('/api/admin/mail', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({
              action: 'send', to: recipients[i], subject: compose.subject, mode: compose.mode, html: finalHtml,
              // 답장(단일 수신)일 때만 스레드 연결. 여러 곳 발송은 독립 메일.
              inReplyTo: recipients.length === 1 ? compose.inReplyTo : null,
            }),
          }, 30000);
          const b = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(b.error || '발송 실패');
          ok += 1;
        } catch {
          failed.push(recipients[i]);
        }
      }
      if (failed.length === 0) {
        toast(recipients.length === 1 ? '메일을 발송했습니다.' : `${ok}곳에 발송했습니다.`, 'success');
      } else {
        toast(`${ok}곳 발송 · ${failed.length}곳 실패 (${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ' 외' : ''})`, 'error');
      }
      if (ok > 0) {
        setCompose(null);
        if (folder === 'outbound') load('outbound');
      }
    } finally {
      setSending(false);
      setSendProgress(null);
    }
  };

  // 보낸 메일을 템플릿처럼 재사용 — 제목·내용 그대로, 받는사람만 비워 다른 곳에 발송.
  const reuse = (m: Mail) => {
    openCompose({
      to: '',
      subject: m.subject ?? '',
      // 저장된 발송본(HTML) 을 그대로 살리려 소스 모드로 연다.
      mode: 'html',
      html: m.body_html || `<div style="white-space:pre-wrap">${escapeHtml(m.body_text ?? '')}</div>`,
      inReplyTo: null,
    });
  };

  const openCompose = (c: Compose) => { htmlRef.current = c.html; setCompose(c); };

  // 작성 모드 전환. 소스→편집기는 표/스타일이 정리될 수 있어 확인을 받는다.
  const switchMode = (next: 'rich' | 'html') => {
    if (!compose || compose.mode === next) return;
    if (next === 'rich' && /<(table|style|center|font|h1|h4|h5|h6)\b/i.test(compose.html)
      && !confirm('서식 편집기로 바꾸면 표·스타일 등 일부 HTML 이 단순화될 수 있습니다. 계속할까요?')) {
      return;
    }
    htmlRef.current = compose.html;
    setCompose({ ...compose, mode: next });
  };

  const reply = (m: Mail) => {
    const to = addrOnly(m.from_addr);
    const subject = m.subject?.startsWith('Re:') ? m.subject : `Re: ${m.subject ?? ''}`;
    // 원문을 HTML 인용 블록으로 프리필(에디터에서 위에 답장 작성).
    const quotedLines = escapeHtml(m.body_text ?? '').split('\n').map((l) => l || '<br>').join('<br>');
    const quoted = `<p><br></p><p>――――――――</p><p>${escapeHtml(fmt(m.created_at))} ${escapeHtml(addrOnly(m.from_addr))} 님이 작성:</p><div style="color:#888">${quotedLines}</div>`;
    openCompose({ to, subject, mode: 'rich', html: quoted, inReplyTo: m.message_id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">메일</h1>
          <p className="mt-0.5 text-xs text-gray-500">admin@marie.co.kr 송·수신 관리</p>
        </div>
        <button type="button" onClick={() => openCompose({ to: '', subject: '', mode: 'rich', html: '', inReplyTo: null })} className="btn-primary text-sm">＋ 메일 작성</button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        <button type="button" onClick={() => setFolder('inbound')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${folder === 'inbound' ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
          받은편지함{unread > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full">{unread}</span>}
        </button>
        <button type="button" onClick={() => setFolder('outbound')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${folder === 'outbound' ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
          보낸편지함
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-4">
        {/* 목록 */}
        <div className="platform-panel divide-y divide-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">{folder === 'inbound' ? '받은 메일이 없습니다.' : '보낸 메일이 없습니다.'}</div>
          ) : items.map((m) => {
            const unreadRow = m.direction === 'inbound' && !m.read_at;
            const who = folder === 'inbound' ? addrOnly(m.from_addr) : addrOnly(m.to_addr);
            return (
              <button key={m.id} type="button" onClick={() => openMail(m)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected?.id === m.id ? 'bg-primary-50/50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${unreadRow ? 'font-bold text-ink' : 'text-gray-700'}`}>{who}</span>
                  <span className="shrink-0 text-[11px] text-gray-400">{fmt(m.created_at)}</span>
                </div>
                <div className={`truncate text-sm mt-0.5 ${unreadRow ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{m.subject || '(제목 없음)'}</div>
                <div className="flex items-center gap-1.5">
                  <div className="truncate text-xs text-gray-400 mt-0.5 flex-1">{(m.body_text || '').replace(/\s+/g, ' ').slice(0, 80)}</div>
                  {m.direction === 'outbound' && (
                    m.opened_at
                      ? <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">열람</span>
                      : <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">발송</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 상세 */}
        <div className="platform-panel p-5 min-h-[300px]">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">메일을 선택하세요.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-ink break-words">{selected.subject || '(제목 없음)'}</h2>
                  <p className="mt-1 text-xs text-gray-500 break-all"><span className="text-gray-400">보낸사람</span> {selected.from_addr}</p>
                  <p className="text-xs text-gray-500 break-all"><span className="text-gray-400">받는사람</span> {selected.to_addr}</p>
                  <p className="text-xs text-gray-400">{fmt(selected.created_at)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {selected.direction === 'inbound' && (
                    <button type="button" onClick={() => reply(selected)} className="rounded border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark">답장</button>
                  )}
                  {selected.direction === 'outbound' && (
                    <button type="button" onClick={() => reuse(selected)} className="rounded border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark">다시 보내기</button>
                  )}
                  <button type="button" onClick={() => remove(selected)} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-500 hover:border-rose-400 hover:text-rose-500">삭제</button>
                </div>
              </div>

              {/* 전달 상태 — 발송 접수 / 반송(실패) / 수신확인(열람) + 실시간 확인 버튼 */}
              {selected.direction === 'outbound' && (() => {
                const d = delivery && delivery.id === selected.id ? delivery : null;
                const openedAt = d?.opened_at ?? selected.opened_at;
                const openCount = d?.open_count ?? selected.open_count;
                const bounce = d?.bounce ?? null;
                return (
                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-700">전달 상태</span>
                      <button
                        type="button"
                        onClick={() => checkStatus(selected.id)}
                        disabled={checking}
                        className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        <svg className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M19.5 9.348A7.5 7.5 0 106.83 15.6" /></svg>
                        {checking ? '확인 중…' : '전달 상태 확인'}
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      <li className="flex items-start gap-2 text-gray-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>발송 접수됨 · {fmt(selected.created_at)}</span>
                      </li>
                      {bounce ? (
                        <li className="flex items-start gap-2 text-rose-600">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                          <span><b>전달 실패(반송)</b> · {fmt(bounce.at)} — 받는 주소를 확인하고 다시 보내주세요.</span>
                        </li>
                      ) : openedAt ? (
                        <li className="flex items-start gap-2 text-emerald-600">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span><b>수신확인됨(열람)</b> · {fmt(openedAt)}{openCount > 1 ? ` · ${openCount}회` : ''} — 상대가 받아서 열어봤어요.</span>
                        </li>
                      ) : (
                        <li className="flex items-start gap-2 text-gray-500">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full border border-gray-300" />
                          <span>전달됨(접수 완료) · 아직 열람 전 — 상대가 열어보면 여기에 표시돼요.</span>
                        </li>
                      )}
                    </ul>
                    <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                      메일은 상대 서버 사정으로 몇 분 지연될 수 있어요. 주소 오류 등으로 전달되지 않으면 ‘전달 실패(반송)’로 표시됩니다. 열람은 상대가 이미지를 차단하면 표시되지 않을 수 있어요.
                    </p>
                  </div>
                );
              })()}

              {selected.body_html ? (
                // 신뢰 불가한 수신 HTML → sandbox iframe 으로 격리 렌더(스크립트 실행·부모접근 차단).
                // allow-popups 로 사용자 클릭 링크만 새 탭 허용. 스크립트 없으므로 자동 팝업 불가.
                <iframe
                  title="메일 본문"
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={`<!doctype html><meta charset="utf-8"><base target="_blank"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#333;line-height:1.6;margin:0;padding:4px;word-break:break-word}img{max-width:100%;height:auto}</style>${selected.body_html}`}
                  className="w-full min-h-[420px] rounded border border-gray-100 bg-white"
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-800">{selected.body_text || '(내용 없음)'}</pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 작성/답장 모달 */}
      {compose && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) setCompose(null); }}>
          <div className="my-6 w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-ink">{compose.inReplyTo ? '답장' : '새 메일'}</h3>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500">받는사람</label>
                  {(() => { const n = parseRecipients(compose.to).length; return n > 1 ? <span className="text-[11px] font-bold text-primary">{n}곳</span> : null; })()}
                </div>
                <textarea
                  value={compose.to}
                  onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                  rows={2}
                  placeholder="name@example.com — 여러 곳은 쉼표 또는 줄바꿈으로 구분"
                  className="mt-1 w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-400">여러 웨딩홀에 같은 내용을 보내려면 주소를 줄바꿈/쉼표로 나눠 넣으면 각각 개별 발송됩니다.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">제목</label>
                <input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500">내용</label>
                  <div className="inline-flex overflow-hidden rounded border border-gray-300 text-[11px] font-bold">
                    <button type="button" onClick={() => switchMode('rich')} disabled={sending}
                      className={`px-2.5 py-1 ${compose.mode === 'rich' ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>서식 편집기</button>
                    <button type="button" onClick={() => switchMode('html')} disabled={sending}
                      className={`px-2.5 py-1 border-l border-gray-300 ${compose.mode === 'html' ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>HTML 소스</button>
                  </div>
                </div>
                {compose.mode === 'rich' ? (
                  <>
                    <p className="mb-1 mt-1 text-[11px] text-gray-400">굵기·기울임·제목 크기·정렬·목록과 사진 첨부를 사용할 수 있어요.</p>
                    <RichTextEditor
                      value={compose.html}
                      onChange={(html) => { htmlRef.current = html; setCompose((c) => (c ? { ...c, html } : c)); }}
                      placeholder="내용을 입력하세요. 상단 도구모음으로 서식과 사진을 넣을 수 있어요."
                      minHeight={260}
                      imageUploadEndpoint="/api/admin/upload-image?target=mail"
                      onUploadPromise={trackUpload}
                      disabled={sending}
                    />
                  </>
                ) : (
                  <div className="mt-1 space-y-2">
                    <p className="text-[11px] text-gray-400">완성된 HTML 코드를 붙여넣으세요. 표·링크·인라인 스타일이 그대로 발송됩니다. (<code>&lt;script&gt;</code>·이벤트핸들러 등 위험 요소는 발송 시 자동 제거)</p>
                    <textarea
                      value={compose.html}
                      onChange={(e) => { htmlRef.current = e.target.value; setCompose((c) => (c ? { ...c, html: e.target.value } : c)); }}
                      placeholder={'<table width="600" ...>\n  ...\n</table>'}
                      spellCheck={false}
                      className="h-56 w-full resize-y rounded border border-gray-300 p-3 font-mono text-[12px] leading-relaxed text-gray-800 focus:border-primary focus:outline-none"
                    />
                    <div>
                      <p className="mb-1 text-[11px] font-bold text-gray-500">미리보기</p>
                      <iframe
                        title="HTML 미리보기"
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        srcDoc={`<!doctype html><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo',sans-serif}img{max-width:100%}</style>${compose.html || '<p style="color:#999">미리볼 내용이 없습니다.</p>'}`}
                        className="h-64 w-full rounded border border-gray-200 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCompose(null)} disabled={sending} className="rounded border border-gray-300 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">취소</button>
              <button type="button" onClick={send} disabled={sending} className="btn-primary text-sm disabled:opacity-50">
                {sending
                  ? (pendingCount > 0
                    ? `사진 ${pendingCount}장 마무리 중…`
                    : sendProgress && sendProgress.total > 1
                      ? `발송 중… ${sendProgress.done}/${sendProgress.total}`
                      : '발송 중…')
                  : (() => { const n = parseRecipients(compose.to).length; return n > 1 ? `${n}곳 발송` : '발송'; })()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
