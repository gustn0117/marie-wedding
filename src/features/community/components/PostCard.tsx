import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime, getCategoryLabel } from '@/shared/utils/format';
import type { Post } from '@/types/database';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <Link href={ROUTES.COMMUNITY_DETAIL(post.id)} className="block">
      <article className="card group cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Category Badge */}
            <span className="badge-primary text-xs mb-2 inline-block">
              {getCategoryLabel(post.category)}
            </span>

            {/* Title */}
            <h3 className="font-serif text-lg font-semibold text-text-primary group-hover:text-primary transition-colors duration-200 mb-1.5 line-clamp-1">
              {post.title}
            </h3>

            {/* Content Preview */}
            <p className="text-sm text-text-secondary line-clamp-2 mb-3 leading-relaxed">
              {post.content}
            </p>

            {/* Meta Info */}
            <div className="flex items-center gap-3 text-xs text-text-muted">
              {/* Author */}
              {post.author?.company_name && (
                <span className="font-medium text-text-secondary">
                  {post.author.company_name}
                </span>
              )}

              {/* Separator */}
              {post.author?.company_name && (
                <span className="w-px h-3 bg-border" />
              )}

              {/* View Count */}
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {post.view_count}
              </span>

              {/* Comment Count */}
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                {post.comment_count ?? 0}
              </span>

              {/* Separator */}
              <span className="w-px h-3 bg-border" />

              {/* Relative Time */}
              <time dateTime={post.created_at}>
                {formatRelativeTime(post.created_at)}
              </time>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
