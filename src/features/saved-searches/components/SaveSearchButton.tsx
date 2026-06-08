'use client';

import { useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { savedSearchService } from '@/features/saved-searches/services/savedSearchService';
import type { SavedSearchScope } from '@/types/database';
import { toast } from '@/shared/components/Toast';

interface Props {
  scope: SavedSearchScope;
  query: Record<string, unknown>;
  defaultName?: string;
}

export default function SaveSearchButton({ scope, query, defaultName }: Props) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSave() {
    if (!profile) { toast('로그인이 필요합니다.', 'error'); return; }
    // 간단 inline prompt — 토스트 인프라 prompt 모달은 추후 통합
    const name = window.prompt('이 검색의 이름을 정해주세요.', defaultName ?? '');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await savedSearchService.create({ profileId: profile.id, name: name.trim(), scope, query });
      setDone(true);
      toast('검색을 저장했습니다.', 'success');
    } catch {
      toast('저장에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <span className="text-xs text-primary font-bold inline-flex items-center gap-0.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> 저장됨</span>;
  }

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={busy}
      className="text-xs font-bold text-gray-700 hover:text-primary disabled:opacity-50 inline-flex items-center gap-1"
    >
      {busy ? '저장 중…' : '+ 이 검색 저장'}
    </button>
  );
}
