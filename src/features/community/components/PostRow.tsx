import Link from 'next/link';
import { POST_CATEGORIES, ROUTES } from '@/shared/constants';
import type { Post } from '@/types/database';

/**
 * 게시판 한 줄.
 *
 * 카페 목록의 문법을 그대로 쓴다 — 말머리 + 제목 + 댓글수, 그리고 글쓴이·날짜·조회.
 * 카드가 아니라 행이어야 "글이 쌓여 있다"가 읽힌다. 카드는 한 화면에 서너 개밖에 안 들어가
 * 글이 적을 때 더 휑해 보인다.
 */

function boardLabel(category: string): string {
  return POST_CATEGORIES.find((c) => c.value === category)?.label ?? '자유게시판';
}

// 카페 목록은 오늘 글은 시각, 그 이전은 날짜로 적는다.
function listDate(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600_000);
  const now = new Date(Date.now() + 9 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  const sameDay = kst.getUTCFullYear() === now.getUTCFullYear()
    && kst.getUTCMonth() === now.getUTCMonth()
    && kst.getUTCDate() === now.getUTCDate();
  return sameDay
    ? `${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}`
    : `${p(kst.getUTCMonth() + 1)}.${p(kst.getUTCDate())}`;
}

function isToday(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 24 * 3600_000;
}

export default function PostRow({ post }: { post: Post }) {
  const author = post.is_notice
    ? '마리에 운영팀'
    : (post.author?.company_name || post.author?.contact_name || '알 수 없음');
  const comments = post.comment_count ?? 0;

  return (
    <li className={post.is_notice ? 'bg-primary-50/40' : ''}>
      <Link
        href={ROUTES.COMMUNITY_DETAIL(post.id)}
        className="group flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 transition-colors hover:bg-gray-50 sm:px-4"
      >
        {/* 말머리 — 어느 게시판 글인지 한눈에 */}
        <span
          className={`hidden shrink-0 text-[12px] font-bold sm:block sm:w-[74px]
            ${post.is_notice ? 'text-primary' : 'text-gray-400'}`}
        >
          {post.is_notice ? '공지' : boardLabel(post.category)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            {post.is_notice && (
              <span className="shrink-0 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white sm:hidden">공지</span>
            )}
            <span className={`truncate text-[14.5px] group-hover:underline ${post.is_notice ? 'font-bold text-ink' : 'text-gray-800'}`}>
              {post.title}
            </span>
            {comments > 0 && (
              <span className="shrink-0 text-[12.5px] font-bold text-primary tabular-nums">[{comments}]</span>
            )}
            {!post.is_notice && isToday(post.created_at) && (
              <span className="shrink-0 text-[10px] font-bold text-state-urgent">N</span>
            )}
          </span>
          {/* 모바일 — 글쓴이·날짜·조회를 제목 아래 한 줄로 */}
          <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-gray-400 sm:hidden">
            <span className="truncate">{author}</span>
            <span>·</span>
            <span className="tabular-nums">{listDate(post.created_at)}</span>
            <span>·</span>
            <span className="tabular-nums">조회 {post.view_count.toLocaleString()}</span>
          </span>
        </span>

        {/* 데스크탑 — 표의 나머지 칸 */}
        <span className="hidden shrink-0 truncate text-[12.5px] text-gray-500 sm:block sm:w-[110px]">{author}</span>
        <span className="hidden shrink-0 text-right text-[12.5px] text-gray-400 tabular-nums sm:block sm:w-[46px]">
          {listDate(post.created_at)}
        </span>
        <span className="hidden shrink-0 text-right text-[12.5px] text-gray-400 tabular-nums sm:block sm:w-[46px]">
          {post.view_count.toLocaleString()}
        </span>
      </Link>
    </li>
  );
}
