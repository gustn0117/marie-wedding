/**
 * 페이지 전환 시 즉시 표시되는 skeleton.
 * loading.tsx에서 import 사용.
 */

interface Props {
  variant?: 'list' | 'grid' | 'detail' | 'rail';
  cardCount?: number;
}

export default function PageSkeleton({ variant = 'grid', cardCount = 8 }: Props) {
  if (variant === 'rail') {
    return (
      <div className="lg:grid lg:grid-cols-[var(--rail-w)_1fr] lg:gap-8">
        {/* Rail */}
        <div className="hidden lg:flex flex-col gap-2 sticky top-[calc(var(--header-h)+24px)] self-start" style={{ width: 'var(--rail-w)' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        {/* Content */}
        <div className="min-w-0 space-y-6">
          <HeaderSkeleton />
          <GridSkeleton count={cardCount} />
        </div>
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-6">
        <HeaderSkeleton />
        <div className="surface p-6 space-y-4">
          <div className="h-8 w-2/3 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface p-4 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-6">
        <HeaderSkeleton />
        <div className="surface divide-y divide-gray-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // grid (default)
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <GridSkeleton count={cardCount} />
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <header className="space-y-3 pb-4 border-b border-gray-100">
      <div className="h-4 w-20 bg-primary-100 rounded animate-pulse" />
      <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
    </header>
  );
}

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface overflow-hidden">
          <div className="aspect-[4/3] bg-gray-100 animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-1/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
