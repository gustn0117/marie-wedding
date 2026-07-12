import { createServerQueryClient } from '@/lib/supabase/server-query';

interface BannerRow {
  id: string;
  title: string;
  image_path_pc: string | null;
  image_path_mobile: string | null;
  link_url: string | null;
}

/**
 * 메인 hero 위 배너.
 * createServerQueryClient() 는 service_role 로 RLS 를 우회하므로
 * banners_public_select 정책(deleted_at IS NULL AND is_active AND 노출기간 내)이
 * 자동 적용되지 않는다. 따라서 동일 조건을 쿼리에서 직접 재현한다.
 * 데이터 없으면 아무것도 렌더 안 함.
 */
export default async function HeroBanner() {
  const supabase = createServerQueryClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('banners')
    .select('id, title, image_path_pc, image_path_mobile, link_url')
    .is('deleted_at', null)
    .eq('is_active', true)
    .or(`valid_from.is.null,valid_from.lte.${nowIso}`)
    .or(`valid_until.is.null,valid_until.gte.${nowIso}`)
    .order('display_order', { ascending: true })
    .limit(1);

  const banner = (data?.[0] ?? null) as BannerRow | null;

  // 등록된 배너 없으면 아무것도 렌더 안 함 (placeholder 제거)
  if (!banner) return null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pcUrl = banner.image_path_pc ? `${base}/storage/v1/object/public/banners/${banner.image_path_pc}` : null;
  const mobileUrl = banner.image_path_mobile ? `${base}/storage/v1/object/public/banners/${banner.image_path_mobile}` : pcUrl;

  const Content = (
    <picture className="block w-full">
      {pcUrl && <source media="(min-width: 768px)" srcSet={pcUrl} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mobileUrl ?? pcUrl ?? ''}
        alt={banner.title}
        className="w-full h-auto rounded-2xl"
        loading="eager"
      />
    </picture>
  );

  return (
    <section aria-label={banner.title} className="bg-white">
      <div className="shell-wide py-4">
        {banner.link_url ? (
          <a href={banner.link_url} className="block">
            {Content}
          </a>
        ) : (
          Content
        )}
      </div>
    </section>
  );
}
