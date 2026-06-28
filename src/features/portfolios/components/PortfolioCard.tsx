import Link from 'next/link';
import type { Portfolio } from '@/types/database';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';

interface Props {
  portfolio: Portfolio;
  href?: string;
  showEdit?: boolean;
}

export default function PortfolioCard({ portfolio, href, showEdit }: Props) {
  const cover = portfolio.cover_image || portfolio.images[0] || null;
  // portfolioService 는 'use client' 라 server component에서 호출하면 RSC 직렬화 오류 (digest 288056872).
  // 같은 동작의 resolveStorageUrl 헬퍼로 교체.
  const coverUrl = cover ? resolveStorageUrl(cover, 'portfolios') : null;

  const inner = (
    <article className="platform-panel h-full overflow-hidden transition-colors group-hover:border-primary">
      <div className="aspect-[4/3] bg-secondary-50 overflow-hidden border-b border-gray-100">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={portfolio.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">이미지 없음</div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-gray-900 line-clamp-1 flex-1">{portfolio.title}</h3>
          {portfolio.is_featured && <span className="badge-promoted shrink-0">대표</span>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {portfolio.event_date && <span>{new Date(portfolio.event_date).toLocaleDateString('ko-KR')}</span>}
          {portfolio.role && <span>· {portfolio.role}</span>}
        </div>
        {portfolio.venue_name && (
          <p className="mt-1 text-xs text-gray-400 truncate">{portfolio.venue_name}</p>
        )}
        {showEdit && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <Link
              href={`/mypage/portfolios/${portfolio.id}/edit`}
              className="text-xs font-bold text-primary hover:underline"
            >
              수정 →
            </Link>
          </div>
        )}
      </div>
    </article>
  );

  if (href) {
    return <Link href={href} className="block group">{inner}</Link>;
  }
  return <div className="group">{inner}</div>;
}
