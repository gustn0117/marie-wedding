'use client';

import { useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { savedSearchService } from '@/features/saved-searches/services/savedSearchService';
import type { SavedSearchScope } from '@/types/database';

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
    if (!profile) { window.alert('로그인이 필요합니다.'); return; }
    const name = window.prompt('이 검색의 이름을 정해주세요.', defaultName ?? '');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await savedSearchService.create({ profileId: profile.id, name: name.trim(), scope, query });
      setDone(true);
    } catch {
      window.alert('저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <span className="text-xs text-primary font-bold">✓ 저장됨</span>;
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
