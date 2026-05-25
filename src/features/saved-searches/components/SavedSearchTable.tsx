'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { SavedSearch } from '@/types/database';
import { savedSearchService, searchUrl } from '@/features/saved-searches/services/savedSearchService';
import { toast, toastConfirm } from '@/shared/components/Toast';

export default function SavedSearchTable({ items: initial }: { items: SavedSearch[] }) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  async function onDelete(id: string) {
    const ok = await toastConfirm('이 저장된 검색을 삭제하시겠습니까?');
    if (!ok) return;
    startTransition(async () => {
      try {
        await savedSearchService.remove(id);
        setItems((prev) => prev.filter((x) => x.id !== id));
        toast('삭제되었습니다.', 'success');
      } catch {
        toast('삭제에 실패했습니다.', 'error');
      }
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">저장된 검색이 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {items.map((item) => (
        <li key={item.id} className="py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href={searchUrl(item)} className="text-sm font-bold text-gray-900 hover:text-primary block truncate">
              {item.name}
            </Link>
            <p className="text-xs text-gray-500 truncate">
              {item.scope === 'jobs' ? '공고' : '디렉토리'} · 저장일 {new Date(item.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
          <button
            onClick={() => onDelete(item.id)}
            disabled={pending}
            className="text-xs text-gray-500 hover:text-state-urgent shrink-0 disabled:opacity-50"
          >
            삭제
          </button>
        </li>
      ))}
    </ul>
  );
}
