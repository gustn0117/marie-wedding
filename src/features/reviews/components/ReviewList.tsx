import type { Review, ReviewTag, Profile } from '@/types/database';

interface Props {
  reviews: Array<Review & { reviewer?: Pick<Profile, 'id' | 'company_name' | 'contact_name'> | null }>;
  tagMap: Record<string, ReviewTag>;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function ReviewList({ reviews, tagMap }: Props) {
  if (reviews.length === 0) {
    return <p className="text-sm text-gray-500">아직 작성된 리뷰가 없습니다.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {reviews.map((r) => {
        const reviewerName = r.reviewer?.company_name || r.reviewer?.contact_name || '익명';
        return (
          <li key={r.id} className="py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900">{reviewerName}</p>
              <p className="text-xs text-gray-400">{formatDate(r.created_at)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.tags.map((tagId) => {
                const tag = tagMap[tagId];
                if (!tag) return null;
                const cls = tag.category === 'positive'
                  ? 'border-black text-gray-900'
                  : 'border-gray-400 text-gray-600';
                return (
                  <span
                    key={tagId}
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-bold border ${cls} bg-white`}
                  >
                    {tag.label}
                  </span>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TagFrequency({
  reviews,
  tagMap,
}: {
  reviews: Array<Pick<Review, 'tags'>>;
  tagMap: Record<string, ReviewTag>;
}) {
  const counts = new Map<string, number>();
  reviews.forEach((r) => r.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const entries = Array.from(counts.entries())
    .map(([id, n]) => ({ tag: tagMap[id], n }))
    .filter((x) => x.tag)
    .sort((a, b) => b.n - a.n);

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">받은 태그가 없습니다.</p>;
  }

  const max = entries[0].n;

  return (
    <div className="flex flex-wrap gap-2 items-end">
      {entries.map(({ tag, n }) => {
        const weight = 0.6 + 0.4 * (n / max); // 0.6~1.0 scale
        const fontSize = `${Math.round(11 + 4 * (n / max))}px`;
        const cls = tag.category === 'positive'
          ? 'border-black text-gray-900'
          : 'border-gray-400 text-gray-600';
        return (
          <span
            key={tag.id}
            className={`inline-flex items-center px-2 py-1 border font-bold ${cls} bg-white`}
            style={{ fontSize, opacity: weight }}
          >
            {tag.label}
            <span className="ml-1 text-gray-400">×{n}</span>
          </span>
        );
      })}
    </div>
  );
}
