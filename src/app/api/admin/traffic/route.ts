import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 유입 통계 — 자체 수집한 page_views 를 집계한다.
 * 봇은 기본으로 제외한다(전체 요청의 절반이 스캐너라 섞으면 숫자가 무의미해진다).
 */
export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '7', 10) || 7));
  const includeBots = url.searchParams.get('bots') === '1';
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();
  let q = supabase
    .from('page_views')
    .select('path, source, device, visitor, is_bot, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20000);
  if (!includeBots) q = q.eq('is_bot', false);

  const { data, error } = await q;
  if (error) {
    console.error('[api/admin/traffic] failed:', error);
    return NextResponse.json({ error: '통계를 불러오지 못했습니다.' }, { status: 500 });
  }

  const rows = data ?? [];
  const tally = (key: 'path' | 'source' | 'device') => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = (r[key] as string) || '(없음)';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count }));
  };

  // 날짜별 방문 수 + 순 방문자
  const byDay = new Map<string, { views: number; visitors: Set<string> }>();
  for (const r of rows) {
    const d = new Date(r.created_at as string);
    const key = new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10); // KST 기준
    if (!byDay.has(key)) byDay.set(key, { views: 0, visitors: new Set() });
    const e = byDay.get(key)!;
    e.views += 1;
    if (r.visitor) e.visitors.add(r.visitor as string);
  }
  const daily = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, views: v.views, visitors: v.visitors.size }));

  return NextResponse.json({
    days,
    totalViews: rows.length,
    totalVisitors: new Set(rows.map((r) => r.visitor)).size,
    daily,
    paths: tally('path'),
    sources: tally('source'),
    devices: tally('device'),
  });
}
