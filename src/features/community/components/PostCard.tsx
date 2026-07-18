import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
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
  const isNew = !post.is_notice && Date.now() - new Date(post.created_at).getTime() < 24 * 60 * 60 * 1000;

  return (
    <Link href={ROUTES.COMMUNITY_DETAIL(post.id)} className="platform-data-row group block border-b border-gray-100 last:border-b-0">
      <div className="flex gap-3 p-4">
        {/* 왼쪽 썸네일 (이미지 있는 글만) — 네이버 카페 스타일 */}
        {thumbnail && (
          <div className="shrink-0 w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] bg-gray-100 overflow-hidden rounded border border-gray-100">
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title 행 — 말머리(공지/카테고리) + 제목 + 댓글수 */}
          <h3 className="text-[15.5px] sm:text-[16px] font-semibold text-ink group-hover:text-primary transition-colors leading-snug line-clamp-2">
            {post.is_notice && (
              <span className="mr-1.5 align-middle inline-flex items-center rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold text-white">공지</span>
            )}
            {post.title}
            {isNew && <span className="ml-1 align-middle text-[10px] font-bold text-state-urgent">N</span>}
            {post.comment_count !== undefined && post.comment_count > 0 && (
              <span className="text-primary font-bold ml-1.5 text-[13px]">[{post.comment_count}]</span>
            )}
          </h3>

          {/* Content Preview */}
          {preview && (
            <p className="text-[13px] text-gray-500 line-clamp-1 mt-1 leading-relaxed">{preview}</p>
          )}

          {/* Meta — 작성자 · 시간 · 좋아요 */}
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap mt-2">
            {post.author && (
              <span className="flex items-center gap-1.5">
                <ProfileAvatar profileImage={post.author.profile_image} name={post.author.company_name || post.author.contact_name} size="sm" className="!w-4 !h-4 !text-[9px]" />
                <span className="font-medium text-gray-600">
                  {post.author.company_name || post.author.contact_name}
                </span>
              </span>
            )}
            <span>·</span>
            <time>{formatRelativeTime(post.created_at)}</time>
            {post.like_count > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-state-urgent">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  {post.like_count}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
