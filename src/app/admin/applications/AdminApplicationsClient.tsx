'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/shared/utils/apiFetch';
import { ROUTES } from '@/shared/constants';
import UserDetailModal from '@/features/admin/components/UserDetailModal';
import ResumePreview from '@/features/resumes/components/ResumePreview';
import type { SubmittedResumeSnapshot } from '@/features/resumes/types';
import { APPLICATION_STATUS_LABELS } from '@/features/applications/services/application-service';
import {
  APPLICATION_STAGE_HELP,
  APPLICATION_STAGE_LABELS,
  STALE_UNSEEN_MS,
  type AdminApplicationDetail,
  type AdminApplicationList,
  type AdminApplicationRow,
  type AdminContact,
  type ApplicationStage,
} from '@/features/admin/applicationStages';

// 탭 순서 — 공고자 확인 단계가 진행되는 순서대로. '기록 없음'은 해당 지원이 있을 때만 보인다.
const TABS: Array<ApplicationStage | 'all'> = ['all', 'unseen', 'seen', 'opened', 'responded', 'cancelled', 'untracked'];
const STAGE_PARAM = new Set<string>(TABS);

const KST = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 'MM.DD HH:mm'(올해가 아니면 연도 포함, 한국 시간) */
function fmt(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = Object.fromEntries(KST.formatToParts(date).map((part) => [part.type, part.value]));
  const thisYear = KST.formatToParts(new Date()).find((part) => part.type === 'year')?.value;
  const md = `${p.month}.${p.day} ${p.hour}:${p.minute}`;
  return p.year === thisYear ? md : `${p.year}.${md}`;
}

/** 두 시각 사이 — '45분', '3시간 10분', '2일 4시간' */
function gap(fromIso: string | null | undefined, toIso: string | null | undefined): string {
  if (!fromIso || !toIso) return '';
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return '1분 안';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`;
  const days = Math.floor(hours / 24);
  return `${days}일${hours % 24 ? ` ${hours % 24}시간` : ''}`;
}

const STAGE_BADGE: Record<ApplicationStage, string> = {
  unseen: 'border border-gray-400 bg-white text-gray-800',
  seen: 'bg-gray-100 text-gray-700',
  opened: 'bg-primary-50 text-primary',
  responded: 'bg-primary text-white',
  cancelled: 'bg-gray-100 text-gray-500',
  untracked: 'border border-dashed border-gray-300 bg-white text-gray-500',
};

function StageBadge({ stage }: { stage: ApplicationStage }) {
  return <span className={`badge whitespace-nowrap ${STAGE_BADGE[stage]}`}>{APPLICATION_STAGE_LABELS[stage]}</span>;
}

function completionLabel(row: { hiringCompletedAt: string | null; applicantCompletedAt: string | null }): string {
  if (row.hiringCompletedAt && row.applicantCompletedAt) return '진행 완료';
  if (row.hiringCompletedAt) return '공고자 완료 표시';
  if (row.applicantCompletedAt) return '지원자 완료 표시';
  return '';
}

export default function AdminApplicationsClient() {
  const params = useSearchParams();
  const initialStage = params.get('stage') ?? 'all';
  const [stage, setStage] = useState<ApplicationStage | 'all'>(
    STAGE_PARAM.has(initialStage) ? (initialStage as ApplicationStage | 'all') : 'all',
  );
  const [jobId, setJobId] = useState(() => params.get('jobId') ?? '');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminApplicationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams();
    if (stage !== 'all') search.set('stage', stage);
    if (jobId) search.set('jobId', jobId);
    if (query) search.set('q', query);
    if (includeDeleted) search.set('deleted', '1');
    if (page > 1) search.set('page', String(page));
    setLoading(true);
    setError('');
    apiFetch(`/api/admin/applications?${search.toString()}`, { credentials: 'include', signal: controller.signal }, 20_000)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((body as { error?: string }).error || '지원 현황을 불러오지 못했습니다.');
        setData(body as AdminApplicationList);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '지원 현황을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [stage, jobId, query, includeDeleted, page, reloadKey]);

  const selectStage = (next: ApplicationStage | 'all') => {
    setStage(next);
    setPage(1);
  };
  const filterJob = (id: string) => {
    setJobId(id);
    setStage('all');
    setPage(1);
    setDetailId(null);
  };

  const summary = data?.summary;
  const countOf = (tab: ApplicationStage | 'all') => (summary ? (tab === 'all' ? summary.total : summary[tab]) : 0);
  const visibleTabs = TABS.filter((tab) => tab !== 'untracked' || countOf('untracked') > 0 || stage === 'untracked');
  const totalPages = data ? Math.max(1, Math.ceil(data.totalFiltered / data.pageSize)) : 1;

  return (
    <>
      <div className="space-y-5">
        <div>
          <h1 className="page-title">지원 현황</h1>
          <p className="mt-1 text-sm text-gray-500">
            누가 어느 공고에 지원했고, 공고자가 확인·열람·응답했는지 봅니다.
            {data && <> 공고자 확인 기록은 {fmt(data.trackingSince)}부터 남습니다.</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(queryInput.trim());
              setPage(1);
            }}
            className="min-w-[220px] max-w-md flex-1"
            role="search"
          >
            <div className="flex overflow-hidden rounded border border-gray-200 bg-white">
              <input
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="지원자·공고 제목·업체 이름 검색"
                aria-label="지원자·공고 제목·업체 이름 검색"
                className="flex-1 px-4 py-2.5 text-sm outline-none"
              />
              <button type="submit" className="px-4 text-gray-500 hover:text-primary" aria-label="검색">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>
            </div>
          </form>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => {
                setIncludeDeleted(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            탈퇴·삭제된 지원 포함
          </label>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="ml-auto rounded border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-ink hover:text-ink"
          >
            새로고침
          </button>
        </div>

        {(jobId || query) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {jobId && (
              <button
                type="button"
                onClick={() => filterJob('')}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary bg-primary-50 px-3 py-1 font-semibold text-primary"
              >
                <span className="truncate">공고: {data?.job?.title ?? '선택한 공고'}</span>
                <span aria-hidden>×</span>
                <span className="sr-only">공고 조건 해제</span>
              </button>
            )}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setQueryInput('');
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 font-semibold text-gray-700"
              >
                검색: {query}
                <span aria-hidden>×</span>
                <span className="sr-only">검색 조건 해제</span>
              </button>
            )}
          </div>
        )}

        {/* 단계별 개수 — 누르면 그 단계만 */}
        <div role="tablist" aria-label="공고자 확인 단계" className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => {
            const active = stage === tab;
            const count = countOf(tab);
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectStage(tab)}
                className={`min-w-[96px] rounded border px-3 py-2 text-left transition-colors ${
                  active ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-primary'
                }`}
              >
                <span className="block text-[12px] font-semibold">{tab === 'all' ? '전체' : APPLICATION_STAGE_LABELS[tab]}</span>
                <span className="mt-0.5 block text-lg font-extrabold tabular-nums">{summary ? count.toLocaleString() : '–'}</span>
                {tab === 'unseen' && summary && summary.unseenStale > 0 && (
                  <span className={`block text-[11px] font-bold ${active ? 'text-white' : 'text-state-urgent'}`}>
                    3일 넘음 {summary.unseenStale}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {stage !== 'all' && <p className="text-xs text-gray-500">{APPLICATION_STAGE_HELP[stage]}</p>}

        {data?.truncated && (
          <p className="text-xs text-gray-500">지원이 많아 최근 3,000건만 집계했습니다. 검색이나 공고 조건으로 좁혀 보세요.</p>
        )}

        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          {/* relative — 표 안의 화면낭독기용 숨김 글자(absolute)가 스크롤 상자 밖 기준으로 잡혀 페이지가 넓어지지 않게 */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th scope="col" className="px-4 py-3 font-medium text-gray-500">지원 시각</th>
                  <th scope="col" className="px-4 py-3 font-medium text-gray-500">지원자</th>
                  <th scope="col" className="px-4 py-3 font-medium text-gray-500">공고 · 공고자</th>
                  <th scope="col" className="px-4 py-3 font-medium text-gray-500">공고자 확인</th>
                  <th scope="col" className="px-4 py-3 font-medium text-gray-500">처리 상태</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-gray-500"><span className="sr-only">상세</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && !data ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-4"><div className="h-5 animate-pulse rounded bg-gray-100" /></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <p className="text-sm text-gray-600">{error}</p>
                      <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-2 text-sm font-bold text-primary hover:underline">
                        다시 불러오기
                      </button>
                    </td>
                  </tr>
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                      {summary && summary.total === 0 ? '아직 접수된 지원이 없습니다.' : '조건에 맞는 지원이 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  data.items.map((row) => (
                    <ApplicationRowView
                      key={row.id}
                      row={row}
                      dimmed={loading}
                      onOpen={() => setDetailId(row.id)}
                      onUser={setUserId}
                      onJob={filterJob}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                이전
              </button>
              <span className="px-2 text-sm tabular-nums text-gray-600">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                다음
              </button>
            </div>
          )}
        </div>
      </div>

      {/* space-y 안에 두면 고정 위치 창에도 위 여백이 붙어 화면 맨 위가 덮이지 않는다 → 바깥에 둔다 */}
      <ApplicationDetailDrawer
        id={detailId}
        escapeEnabled={!userId}
        onClose={() => setDetailId(null)}
        onUser={setUserId}
        onJob={filterJob}
      />
      <UserDetailModal userId={userId} onClose={() => setUserId(null)} />
    </>
  );
}

function ApplicationRowView({
  row,
  dimmed,
  onOpen,
  onUser,
  onJob,
}: {
  row: AdminApplicationRow;
  dimmed: boolean;
  onOpen: () => void;
  onUser: (id: string) => void;
  onJob: (id: string) => void;
}) {
  const now = new Date().toISOString();
  const stale = row.stage === 'unseen' && Date.now() - Date.parse(row.createdAt) > STALE_UNSEEN_MS;
  const completion = completionLabel(row);
  return (
    <tr className={`align-top ${row.deletedAt ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'} ${dimmed ? 'opacity-60' : ''}`}>
      <td className="whitespace-nowrap px-4 py-3">
        <p className="tabular-nums text-gray-800">{fmt(row.createdAt)}</p>
        {row.deletedAt && <span className="badge mt-1 bg-gray-200 text-gray-600">삭제됨</span>}
      </td>
      <td className="px-4 py-3">
        {row.applicant ? (
          <button type="button" onClick={() => onUser(row.applicant!.id)} className="text-left font-semibold text-gray-900 hover:text-primary hover:underline">
            {row.applicant.name}
          </button>
        ) : (
          <span className="text-gray-400">알 수 없음</span>
        )}
        {row.applicant?.deleted && <span className="badge ml-1 bg-gray-200 text-gray-600">탈퇴</span>}
      </td>
      <td className="max-w-[300px] px-4 py-3">
        {row.job ? (
          <button
            type="button"
            onClick={() => onJob(row.job!.id)}
            className="block max-w-full truncate text-left font-semibold text-gray-900 hover:text-primary hover:underline"
            title={`${row.job.title} — 이 공고의 지원만 보기`}
          >
            {row.job.title}
          </button>
        ) : (
          <span className="text-gray-400">삭제된 공고</span>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
          {row.author ? (
            <button type="button" onClick={() => onUser(row.author!.id)} className="hover:text-primary hover:underline">
              {row.author.name}
            </button>
          ) : (
            <span>공고자 없음</span>
          )}
          {row.job?.isProxy && <span className="badge bg-gray-100 text-gray-600">대행</span>}
          {row.job?.deleted && <span className="badge bg-gray-200 text-gray-600">공고 삭제</span>}
        </p>
      </td>
      <td className="px-4 py-3">
        <StageBadge stage={row.stage} />
        <p className={`mt-1 text-xs ${stale ? 'font-bold text-state-urgent' : 'text-gray-500'}`}>
          {row.stage === 'unseen' && `접수 후 ${gap(row.createdAt, now) || '방금'} 지남`}
          {row.stage === 'untracked' && '기록 시작 전 접수'}
          {row.view && row.stage !== 'unseen' && row.stage !== 'untracked' && (
            row.view.detailOpenedAt
              ? `지원서 열람 ${fmt(row.view.detailOpenedAt)}`
              : `목록 확인 ${fmt(row.view.firstSeenAt)} (접수 ${gap(row.createdAt, row.view.firstSeenAt)} 후)`
          )}
          {!row.view && (row.stage === 'responded' || row.stage === 'cancelled') && '확인 기록 없음'}
        </p>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-800">{APPLICATION_STATUS_LABELS[row.status]}</p>
        {row.firstRespondedAt && (
          <p className="mt-0.5 text-xs text-gray-500">첫 응답 {fmt(row.firstRespondedAt)} (접수 {gap(row.createdAt, row.firstRespondedAt)} 후)</p>
        )}
        {completion && <p className="mt-0.5 text-xs font-semibold text-primary">{completion}</p>}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onOpen}
          className="whitespace-nowrap rounded border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary"
        >
          상세
        </button>
      </td>
    </tr>
  );
}

function ApplicationDetailDrawer({
  id,
  escapeEnabled,
  onClose,
  onUser,
  onJob,
}: {
  id: string | null;
  escapeEnabled: boolean;
  onClose: () => void;
  onUser: (id: string) => void;
  onJob: (id: string) => void;
}) {
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) {
      setDetail(null);
      setError('');
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setError('');
    apiFetch(`/api/admin/applications?id=${encodeURIComponent(id)}`, { credentials: 'include', signal: controller.signal }, 20_000)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((body as { error?: string }).error || '지원 정보를 불러오지 못했습니다.');
        setDetail(body as AdminApplicationDetail);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '지원 정보를 불러오지 못했습니다.');
      });
    closeRef.current?.focus();
    return () => controller.abort();
  }, [id]);

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && escapeEnabled) onClose();
  }, [escapeEnabled, onClose]);
  useEffect(() => {
    if (!id) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [id, handleKey]);

  if (!id) return null;
  const app = detail?.application;
  const resume = (detail?.resume ?? null) as SubmittedResumeSnapshot | null;

  return (
    <div className="fixed inset-0 z-[45] flex justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-detail-title"
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-500">지원 상세</p>
            <h2 id="application-detail-title" className="mt-0.5 break-keep text-lg font-bold text-ink">
              {detail ? `${detail.applicant?.name ?? '지원자'} → ${detail.job?.title ?? '삭제된 공고'}` : '불러오는 중…'}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-ink"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {error ? (
            <p className="rounded border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">{error}</p>
          ) : !detail || !app ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />)}
            </div>
          ) : (
            <>
              <section aria-labelledby="timeline-title">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="timeline-title" className="text-sm font-bold text-ink">진행 기록</h3>
                  <StageBadge stage={app.stage} />
                  <span className="text-xs text-gray-500">처리 상태: {APPLICATION_STATUS_LABELS[app.status]}</span>
                </div>
                <ol className="mt-3 space-y-0 border-l border-gray-200">
                  <TimelineItem label="지원 접수" at={app.createdAt} done />
                  <TimelineItem
                    label="공고자 확인(목록)"
                    at={detail.view?.firstSeenAt}
                    since={app.createdAt}
                    done={!!detail.view}
                    empty={app.stage === 'untracked' ? '기록 시작 전 접수 — 그동안 봤는지는 알 수 없음' : '아직 보지 않음'}
                  />
                  <TimelineItem
                    label="지원서 열람"
                    at={detail.view?.detailOpenedAt}
                    since={app.createdAt}
                    done={!!detail.view?.detailOpenedAt}
                    empty="아직 열지 않음"
                    extra={detail.view?.detailLastOpenedAt && detail.view.detailLastOpenedAt !== detail.view.detailOpenedAt
                      ? `마지막 열람 ${fmt(detail.view.detailLastOpenedAt)}`
                      : undefined}
                  />
                  <TimelineItem
                    label="공고자 첫 응답"
                    at={app.firstRespondedAt}
                    since={app.createdAt}
                    done={!!app.firstRespondedAt}
                    empty={app.status === 'cancelled' ? '지원자가 취소함' : '아직 응답 없음(상태 변경 전)'}
                  />
                  {(app.hiringCompletedAt || app.applicantCompletedAt) && (
                    <TimelineItem
                      label="진행 완료 표시"
                      at={app.hiringCompletedAt && app.applicantCompletedAt
                        ? (app.hiringCompletedAt > app.applicantCompletedAt ? app.hiringCompletedAt : app.applicantCompletedAt)
                        : (app.hiringCompletedAt ?? app.applicantCompletedAt)}
                      done
                      extra={completionLabel(app)}
                    />
                  )}
                </ol>
                {detail.view && (
                  <p className="mt-2 text-xs text-gray-500">공고자가 마지막으로 본 시각: {fmt(detail.view.lastSeenAt)}</p>
                )}
                {app.deletedAt && <p className="mt-2 text-xs font-semibold text-gray-600">이 지원은 {fmt(app.deletedAt)}에 삭제(탈퇴 등)되었습니다.</p>}
              </section>

              <section aria-labelledby="contacts-title">
                <h3 id="contacts-title" className="text-sm font-bold text-ink">연락처</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ContactCard title="지원자" person={detail.applicant} extraPhone={app.contactPhone} extraPhoneLabel="지원 시 남긴 연락처" onUser={onUser} />
                  <ContactCard
                    title={detail.job?.isProxy ? '공고자 (대행 공고)' : '공고자'}
                    person={detail.author}
                    onUser={onUser}
                    proxy={detail.job?.isProxy ? { name: detail.job.proxyCompanyName, contact: detail.job.proxyContact } : null}
                  />
                </div>
              </section>

              {detail.job && (
                <section className="flex flex-wrap gap-2">
                  <a
                    href={ROUTES.JOBS_DETAIL(detail.job.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center rounded border border-gray-300 px-3 text-xs font-bold text-gray-700 hover:border-ink hover:text-ink"
                  >
                    공고 보기 (새 탭)
                  </a>
                  <button
                    type="button"
                    onClick={() => onJob(detail.job!.id)}
                    className="inline-flex min-h-[40px] items-center rounded border border-gray-300 px-3 text-xs font-bold text-gray-700 hover:border-ink hover:text-ink"
                  >
                    이 공고의 지원만 보기
                  </button>
                </section>
              )}

              <section aria-labelledby="message-title">
                <h3 id="message-title" className="text-sm font-bold text-ink">지원 메시지</h3>
                <p className="mt-2 whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
                  {app.message || '(메시지 없음)'}
                </p>
              </section>

              <section aria-labelledby="resume-title">
                <h3 id="resume-title" className="text-sm font-bold text-ink">제출 이력서</h3>
                <div className="mt-2">
                  {resume ? (
                    <ResumePreview resume={resume} submittedAt={detail.resumeSubmittedAt ?? app.createdAt} fileUrls={detail.fileUrls} />
                  ) : (
                    <p className="rounded border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                      제출 이력서가 없습니다(이력서 제출 기능 도입 전 접수).
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  at,
  since,
  done,
  empty,
  extra,
}: {
  label: string;
  at?: string | null;
  since?: string;
  done: boolean;
  empty?: string;
  extra?: string;
}) {
  const after = since && at ? gap(since, at) : '';
  return (
    <li className="relative pb-4 pl-5 last:pb-0">
      <span
        aria-hidden
        className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${done ? 'bg-primary' : 'border border-gray-300 bg-white'}`}
      />
      <p className={`text-sm font-semibold ${done ? 'text-gray-900' : 'text-gray-500'}`}>{label}</p>
      <p className="mt-0.5 text-xs text-gray-500">
        {done && at ? `${fmt(at)}${after ? ` · 접수 ${after} 후` : ''}` : empty}
        {extra ? `${done && at ? ' · ' : ''}${extra}` : ''}
      </p>
    </li>
  );
}

function ContactCard({
  title,
  person,
  extraPhone,
  extraPhoneLabel,
  proxy,
  onUser,
}: {
  title: string;
  person: AdminContact | null;
  extraPhone?: string | null;
  extraPhoneLabel?: string;
  proxy?: { name: string | null; contact: string | null } | null;
  onUser: (id: string) => void;
}) {
  return (
    <div className="rounded border border-gray-200 px-4 py-3">
      <p className="text-[11px] font-bold text-gray-500">{title}</p>
      {person ? (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 font-semibold text-gray-900">
            {person.name}
            {person.deleted && <span className="badge bg-gray-200 text-gray-600">탈퇴</span>}
          </p>
          <dl className="mt-2 space-y-1 text-xs">
            {extraPhone && <Row label={extraPhoneLabel ?? '연락처'} value={extraPhone} />}
            <Row label="프로필 전화" value={person.phone} />
            <Row label="이메일" value={person.email} />
          </dl>
          <button type="button" onClick={() => onUser(person.id)} className="mt-2 text-xs font-bold text-primary hover:underline">
            회원 정보 보기
          </button>
        </>
      ) : (
        <p className="mt-1 text-sm text-gray-500">정보 없음</p>
      )}
      {proxy && (proxy.name || proxy.contact) && (
        <dl className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs">
          <Row label="대행 업체" value={proxy.name} />
          <Row label="업체 연락처" value={proxy.contact} />
        </dl>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 break-all text-gray-800">{value || '—'}</dd>
    </div>
  );
}
