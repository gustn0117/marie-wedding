import { createServerQueryClient } from '@/lib/supabase/server-query';

interface BannerRow {
  id: string;
  title: string;
  image_path_pc: string | null;
  image_path_mobile: string | null;
  link_url: string | null;
}

/**
 * 메인 hero 위 배너. 공개 SELECT 정책으로 활성+기간 내 자동 필터.
 * 데이터 없으면 빗금 placeholder.
 */
export default async function HeroBanner() {
  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('banners')
    .select('id, title, image_path_pc, image_path_mobile, link_url')
    .order('display_order', { ascending: true })
    .limit(1);

  const banner = (data?.[0] ?? null) as BannerRow | null;

  if (!banner) {
    // Placeholder — 빗금 패턴
    return (
      <section aria-label="배너 영역" className="bg-white">
        <div className="shell-wide py-4">
          <div
            className="w-full rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm font-semibold"
            style={{
              aspectRatio: '8 / 1',
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(0,0,0,0.04) 12px, rgba(0,0,0,0.04) 24px)',
            }}
          >
            배너 영역 (관리자에서 등록 가능)
          </div>
        </div>
      </section>
    );
  }

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
