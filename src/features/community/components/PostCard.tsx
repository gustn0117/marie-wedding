import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime, getCategoryLabel } from '@/shared/utils/format';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import type { Post } from '@/types/database';

interface PostCardProps {
  post: Post;
}

// HTML 본문에서 첫 이미지 URL 추출
function extractFirstImage(html: string): string | null {
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : null;
}

export default function PostCard({ post }: PostCardProps) {
  const thumbnail = extractFirstImage(post.content);
  const preview = post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <Link href={ROUTES.COMMUNITY_DETAIL(post.id)} className="block bg-white border border-gray-200 hover:border-primary transition-colors group">
      <div className="flex gap-4 p-4 sm:p-5">
        <div className="flex-1 min-w-0">
          {/* Category + New Badge */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary text-[11px] font-semibold">
              {getCategoryLabel(post.category)}
            </span>
            {Date.now() - new Date(post.created_at).getTime() < 24 * 60 * 60 * 1000 && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-500 text-[10px] font-bold">N</span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-[16px] sm:text-[17px] font-bold text-gray-900 group-hover:text-primary transition-colors leading-snug mb-1.5 line-clamp-2">
            {post.title}
            {post.comment_count !== undefined && post.comment_count > 0 && (
              <span className="text-primary font-bold ml-1.5 text-sm">[{post.comment_count}]</span>
            )}
          </h3>

          {/* Content Preview */}
          {preview && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3 leading-relaxed">{preview}</p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            {post.author && (
              <span className="flex items-center gap-1.5">
                <ProfileAvatar profileImage={post.author.profile_image} name={post.author.company_name || post.author.contact_name} size="sm" className="!w-5 !h-5 !text-[10px]" />
                <span className="font-medium text-gray-600">
                  {post.author.company_name || post.author.contact_name}
                </span>
              </span>
            )}
            <span>·</span>
            <time>{formatRelativeTime(post.created_at)}</time>
            <span>·</span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {post.view_count.toLocaleString()}
            </span>
            {post.like_count > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-red-500">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  {post.like_count}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        {thumbnail && (
          <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 overflow-hidden border border-gray-100">
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </Link>
  );
}
