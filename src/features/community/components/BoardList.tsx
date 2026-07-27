'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Pagination from '@/shared/components/Pagination';
import PostRow from './PostRow';
import { POST_CATEGORIES, ROUTES } from '@/shared/constants';
import type { Post } from '@/types/database';

const PAGE_SIZE = 10;

interface BoardListProps {
  posts: Post[];
  totalCount: number;
}

/** 현재 보고 있는 게시판 이름 */
function boardTitle(category: string | null, search: string | null): string {
  if (search) return `'${search}' 검색 결과`;
  if (!category) return '전체글';
  return POST_CATEGORIES.find((c) => c.value === category)?.label ?? '전체글';
}

export default function BoardList({ posts, totalCount }: BoardListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const goPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(next));
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="border border-gray-200 bg-white">
      {/* 게시판 머리 — 지금 어디를 보고 있는지 + 글 수 */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-3 sm:px-4">
        <h2 className="flex items-baseline gap-2 text-[15px] font-bold text-ink">
          {boardTitle(category, search)}
          <span className="text-[12.5px] font-normal text-gray-400 tabular-nums">{totalCount.toLocaleString()}개</span>
        </h2>
        <Link href={ROUTES.COMMUNITY_NEW} className="shrink-0 text-[13px] font-bold text-primary hover:underline lg:hidden">
          글쓰기
        </Link>
      </div>

      {/* 표 머리 — 데스크탑에서만. 목록이 '표'로 읽히게 하는 장치 */}
      {posts.length > 0 && (
        <div className="hidden items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-[11.5px] font-bold text-gray-500 sm:flex">
          <span className="w-[74px] shrink-0">게시판</span>
          <span className="min-w-0 flex-1">제목</span>
          <span className="w-[110px] shrink-0">글쓴이</span>
          <span className="w-[46px] shrink-0 text-right">날짜</span>
          <span className="w-[46px] shrink-0 text-right">조회</span>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-[15px] font-bold text-gray-700">
            {search ? '검색 결과가 없습니다' : '아직 글이 없는 게시판입니다'}
          </p>
          <p className="mt-1.5 text-[13.5px] text-gray-500">
            {search ? '다른 낱말로 찾아보세요.' : '첫 글을 남기면 이 게시판이 시작됩니다.'}
          </p>
          {!search && (
            <Link href={ROUTES.COMMUNITY_NEW} className="btn-primary mt-5 inline-flex text-sm">
              첫 글 쓰기
            </Link>
          )}
        </div>
      ) : (
        <ul>
          {posts.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="border-t border-gray-200 px-3 py-4">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={goPage} />
        </div>
      )}
    </div>
  );
}
