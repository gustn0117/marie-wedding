import type { MetadataRoute } from 'next';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { SITE_URL } from '@/shared/seo';

// 매 크롤 시 최신 목록을 반영하도록 동적 생성.
// (force-dynamic 이면 Next 15 가 revalidate 를 0 으로 강제하므로 revalidate 는 두지 않는다.)
export const dynamic = 'force-dynamic';

type Row = { id: string; updated_at: string | null; created_at?: string | null };

// 단일 sitemap.xml 총 URL 상한(구글 50k/50MB). 정적 + 4개 테이블을 합쳐도 넘지 않게 총량 기준.
// 이 이상 커지면 generateSitemaps() 로 파일 분할 필요.
const TOTAL_URL_CAP = 45000;

// PostgREST 는 1회 select 를 1000행으로 제한 → range 로 전부 페이지네이션. limit 으로 상한.
async function fetchAll(
  table: 'jobs' | 'profiles' | 'posts' | 'events',
  applyFilters: (q: ReturnType<ReturnType<typeof createServerQueryClient>['from']>) => unknown,
  limit: number,
): Promise<Row[]> {
  const supabase = createServerQueryClient();
  const PAGE = 1000;
  const rows: Row[] = [];
  for (let from = 0; from < limit; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = applyFilters(supabase.from(table).select('id, updated_at, created_at') as any) as any;
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return rows.slice(0, limit);
}

function entry(path: string, lastmod?: string | null, changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'], priority?: number): MetadataRoute.Sitemap[number] {
  const d = lastmod ? new Date(lastmod) : undefined;
  return {
    url: `${SITE_URL}${path}`,
    lastModified: d && !Number.isNaN(d.getTime()) ? d : undefined,
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    entry('/', undefined, 'daily', 1),
    entry('/jobs', undefined, 'hourly', 0.9),
    entry('/directory', undefined, 'daily', 0.8),
    entry('/community', undefined, 'daily', 0.7),
    entry('/events', undefined, 'daily', 0.6),
    entry('/contact', undefined, 'monthly', 0.3),
    entry('/terms', undefined, 'yearly', 0.2),
    entry('/privacy', undefined, 'yearly', 0.2),
  ];

  try {
    // 총 URL 이 단일 sitemap 상한을 넘지 않도록, 우선순위 순(공고>프로필>커뮤니티>행사)으로
    // 남은 예산만큼만 순차 수집. 각 fetchAll 은 남은 예산을 limit 으로 받는다.
    const dyn: MetadataRoute.Sitemap = [];
    let remaining = TOTAL_URL_CAP - staticEntries.length;

    const jobs = remaining > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await fetchAll('jobs', (q) => (q as any).is('deleted_at', null).eq('posting_type', 'hiring').eq('hidden_by_admin', false).neq('status', 'hidden'), remaining)
      : [];
    dyn.push(...jobs.map((r) => entry(`/jobs/${r.id}`, r.updated_at ?? r.created_at, 'daily', 0.8)));
    remaining -= jobs.length;

    const profiles = remaining > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await fetchAll('profiles', (q) => (q as any).is('deleted_at', null).eq('is_directory_listed', true), remaining)
      : [];
    dyn.push(...profiles.map((r) => entry(`/directory/${r.id}`, r.updated_at ?? r.created_at, 'weekly', 0.6)));
    remaining -= profiles.length;

    const posts = remaining > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await fetchAll('posts', (q) => (q as any).is('deleted_at', null), remaining)
      : [];
    dyn.push(...posts.map((r) => entry(`/community/${r.id}`, r.updated_at ?? r.created_at, 'weekly', 0.5)));
    remaining -= posts.length;

    const events = remaining > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await fetchAll('events', (q) => (q as any).is('deleted_at', null), remaining)
      : [];
    dyn.push(...events.map((r) => entry(`/events/${r.id}`, r.updated_at ?? r.created_at, 'weekly', 0.5)));

    return [...staticEntries, ...dyn];
  } catch {
    // DB 문제 시에도 최소한 정적 URL 은 제공(사이트맵 자체가 500 나지 않게)
    return staticEntries;
  }
}
