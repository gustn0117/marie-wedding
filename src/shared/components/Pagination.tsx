'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getVisiblePages = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
      start = 2;
      end = Math.min(maxVisible, totalPages - 1);
    } else if (currentPage >= totalPages - 2) {
      start = Math.max(2, totalPages - maxVisible + 1);
      end = totalPages - 1;
    }

    if (start > 2) pages.push('ellipsis');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('ellipsis');

    pages.push(totalPages);
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="페이지 네비게이션">
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-2 rounded-lg text-text-secondary hover:bg-secondary transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="이전 페이지"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      {/* Page Numbers */}
      {visiblePages.map((page, index) =>
        page === 'ellipsis' ? (
          <span
            key={`ellipsis-${index}`}
            className="w-10 h-10 flex items-center justify-center text-sm text-text-muted"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors duration-200 ${
              page === currentPage
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-secondary'
            }`}
            aria-label={`${page} 페이지`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-lg text-text-secondary hover:bg-secondary transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="다음 페이지"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </nav>
  );
}
