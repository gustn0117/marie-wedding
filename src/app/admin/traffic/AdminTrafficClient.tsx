'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';

interface Row { name: string; count: number }
interface Daily { date: string; views: number; visitors: number }
interface Traffic {
  days: number;
  totalViews: number;
  totalVisitors: number;
  daily: Daily[];
  paths: Row[];
  sources: Row[];
  devices: Row[];
}

const SOURCE_LABEL: Record<string, string> = {
  direct: '직접 유입 (주소 입력·메일 클릭)',
  google: '구글 검색',
  naver: '네이버 검색',
  daum: '다음·카카오',
  bing: '빙 검색',
  sns: 'SNS',
  internal: '사이트 내부 이동',
};

export default function AdminTrafficClient() {
  const [data, setData] = useState<Traffic | null>(null);
  const [days, setDays] = useState(7);
  const [bots, setBots] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number, withBots: boolean) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/traffic?days=${d}${withBots ? '&bots=1' : ''}`, { credentials: 'include' }, 20000);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast('통계를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days, bots); }, [days, bots, load]);

  const maxViews = Math.max(1, ...(data?.daily ?? []).map((d) => d.views));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">유입 통계</h1>
          <p className="mt-0.5 text-xs text-gray-500">자체 수집 · 관리자 화면은 집계에서 제외됩니다</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded border border-gray-300 text-xs font-bold">
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)}
                className={`px-3 py-1.5 ${days === d ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {d}일
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
            <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} />
            봇 포함
          </label>
        </div>
      </div>

      {loading ? (
        <div className="platform-panel p-10 text-center text-sm text-gray-400">불러오는 중…</div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label={`${data.days}일 페이지뷰`} value={data.totalViews} />
            <Stat label={`${data.days}일 순 방문자`} value={data.totalVisitors} hint="같은 날 같은 기기는 1명" />
          </div>

          {data.totalViews === 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p className="font-bold">아직 수집된 방문이 없습니다.</p>
              <p className="mt-1">측정은 방금 켜졌습니다. 사이트를 한 번 방문해 보시면 여기에 바로 잡힙니다.</p>
            </div>
          )}

          <Panel title="날짜별 방문">
            {data.daily.length === 0 ? <Empty /> : (
              <ul className="space-y-1.5">
                {data.daily.map((d) => (
                  <li key={d.date} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 tabular-nums text-gray-500">{d.date.slice(5)}</span>
                    <span className="h-3 rounded-sm bg-ink" style={{ width: `${Math.max(2, (d.views / maxViews) * 100)}%` }} />
                    <span className="shrink-0 tabular-nums text-gray-700">{d.views}회 · {d.visitors}명</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="어디서 들어왔나">
            {data.sources.length === 0 ? <Empty /> : (
              <Bars rows={data.sources} total={data.totalViews} labeler={(n) => SOURCE_LABEL[n] ?? n} />
            )}
          </Panel>

          <Panel title="어떤 화면을 봤나">
            {data.paths.length === 0 ? <Empty /> : <Bars rows={data.paths} total={data.totalViews} />}
          </Panel>

          <Panel title="기기">
            {data.devices.length === 0 ? <Empty /> : <Bars rows={data.devices} total={data.totalViews} />}
          </Panel>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="platform-panel p-4">
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{value.toLocaleString()}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="platform-panel p-4">
      <h2 className="mb-3 text-sm font-bold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-gray-400">데이터가 없습니다.</p>;
}

function Bars({ rows, total, labeler }: { rows: Row[]; total: number; labeler?: (n: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center gap-3 text-xs">
          <span className="w-[190px] shrink-0 truncate text-gray-700" title={r.name}>{labeler ? labeler(r.name) : r.name}</span>
          <span className="h-3 rounded-sm bg-ink" style={{ width: `${Math.max(2, (r.count / max) * 100)}%` }} />
          <span className="shrink-0 tabular-nums text-gray-500">
            {r.count} ({total > 0 ? Math.round((r.count / total) * 100) : 0}%)
          </span>
        </li>
      ))}
    </ul>
  );
}
