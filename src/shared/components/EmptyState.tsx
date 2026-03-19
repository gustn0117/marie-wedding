import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Illustration */}
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
      </div>

      <h3 className="font-serif text-lg font-semibold text-text-primary mb-2">
        {title}
      </h3>
      <p className="text-sm text-text-secondary max-w-sm mb-6">
        {description}
      </p>

      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary text-sm">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
