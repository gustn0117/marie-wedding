import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES, REGIONS, BUSINESS_TYPES } from '@/shared/constants';
import StatsExportButton from '@/features/stats/components/StatsExportButton';
import PageHeader from '@/shared/components/PageHeader';

// Docker 빌드에는 NEXT_PUBLIC_*만 주입하고 service role은 런타임에만 주입한다.
// 빌드 중 통계 DB 조회가 실행되지 않도록 동적 렌더링을 명시한다. 통계 결과 자체는
// unstable_cache로 5분간 캐싱해 요청마다 DB 스캔이 반복되는 것을 막는다.
export const dynamic = 'force-dynamic';

const getStats = unstable_cache(loadStats, ['platform-stats'], { revalidate: 300 });

export const metadata = {
  title: '플랫폼 통계 | Marié',
  description: '마리에 플랫폼의 누적 업체 수, 등록 공고 수, 지역별 활성 업체 등 공공 통계.',
};

async function loadStats() {
  const supabase = createServerQueryClient();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalProfilesRes,
    listedProfilesRes,
    totalJobsRes,
    recentJobsRes,
    totalPostsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_directory_listed', true).is('deleted_at', null),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('hidden_by_admin', false),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('hidden_by_admin', false).gte('created_at', monthAgo),
    supabase.from('posts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
  ]);

  const { data: regionRows } = await supabase
    .from('profiles')
    .select('region')
    .eq('is_directory_listed', true)
    .is('deleted_at', null)
    .limit(5000);

  const regionMap = new Map<string, number>();
  (regionRows ?? []).forEach((r: { region: string | null }) => {
    if (!r.region) return;
    r.region.split(',').filter(Boolean).forEach((reg: string) => {
      const k = reg.trim();
      regionMap.set(k, (regionMap.get(k) ?? 0) + 1);
    });
  });

  const { data: bizRows } = await supabase
    .from('profiles')
    .select('business_type')
    .eq('is_directory_listed', true)
    .is('deleted_at', null)
    .limit(5000);

  const bizMap = new Map<string, number>();
  (bizRows ?? []).forEach((r: { business_type: string | null }) => {
    if (!r.business_type) return;
    r.business_type.split(',').filter(Boolean).forEach((b: string) => {
      const k = b.trim();
      bizMap.set(k, (bizMap.get(k) ?? 0) + 1);
    });
  });

  return {
    totalProfiles: totalProfilesRes.count ?? 0,
    listedProfiles: listedProfilesRes.count ?? 0,
    totalJobs: totalJobsRes.count ?? 0,
    recentJobs: recentJobsRes.count ?? 0,
    totalPosts: totalPostsRes.count ?? 0,
    regionCounts: Array.from(regionMap.entries()).sort((a, b) => b[1] - a[1]),
    bizCounts: Array.from(bizMap.entries()).sort((a, b) => b[1] - a[1]),
  };
}

export default async function StatsPage() {
  const s = await getStats();
  const regionLabel = Object.fromEntries(REGIONS.map((r) => [r.value, r.label]));
  const bizLabel = Object.fromEntries(BUSINESS_TYPES.map((b) => [b.value, b.label]));

  return (
    <main className="mx-auto max-w-[1200px] space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.HOME} className="hover:text-primary">홈</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium">플랫폼 통계</span>
      </nav>

      <PageHeader
        eyebrow="통계"
        title="플랫폼 통계"
        description="마리에에 누적된 업체·공고·콘텐츠 수치. 매 5분 캐싱."
        actions={<StatsExportButton stats={s} regionLabel={regionLabel} bizLabel={bizLabel} />}
      />

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="누적 회원" value={s.totalProfiles} />
        <StatTile label="공개 디렉토리" value={s.listedProfiles} />
        <StatTile label="누적 공고" value={s.totalJobs} />
        <StatTile label="최근 30일 공고" value={s.recentJobs} highlight />
        <StatTile label="커뮤니티 게시글" value={s.totalPosts} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="platform-panel p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">지역별 활성 업체</h2>
          {s.regionCounts.length === 0 ? (
            <p className="text-sm text-gray-500">데이터가 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {s.regionCounts.slice(0, 10).map(([key, n]) => (
                <li key={key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{regionLabel[key] || key}</span>
                  <span className="font-bold text-gray-900 tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="platform-panel p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">업종별 활성 업체</h2>
          {s.bizCounts.length === 0 ? (
            <p className="text-sm text-gray-500">데이터가 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {s.bizCounts.slice(0, 10).map(([key, n]) => (
                <li key={key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{bizLabel[key] || key}</span>
                  <span className="font-bold text-gray-900 tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`metric-tile p-5 ${highlight ? 'border-primary' : ''}`}>
      <p className="text-sm font-bold text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-primary tabular-nums">{value.toLocaleString('ko-KR')}</p>
    </div>
  );
}
