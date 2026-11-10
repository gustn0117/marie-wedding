'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';

/**
 * 내가 차단한 사람 목록(프로필 id) — 화면 어디서든 같은 목록을 쓴다(한 번 받아 두고 차단·해제 때 바로 고친다).
 * 차단한 사람의 글·댓글을 숨기는 일은 화면이 하고, 쪽지를 막는 일은 DB 함수가 한다(/api/blocks 설명 참고).
 */

export interface BlockedUser {
  profileId: string;
  name: string;
  profileImage: string | null;
  blockedAt: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';
interface State {
  ownerId: string | null;
  status: Status;
  ids: ReadonlySet<string>;
  items: BlockedUser[];
}

const EMPTY: State = { ownerId: null, status: 'idle', ids: new Set(), items: [] };
let state: State = EMPTY;
const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load(ownerId: string, force = false) {
  if (!force && state.ownerId === ownerId && (state.status === 'loading' || state.status === 'ready')) return;
  setState({ ownerId, status: 'loading', ...(state.ownerId === ownerId ? {} : { ids: new Set(), items: [] }) });
  try {
    const res = await fetch('/api/blocks', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { items?: BlockedUser[] };
    if (state.ownerId !== ownerId) return; // 그새 다른 계정으로 바뀌었다
    const items = data.items ?? [];
    setState({ status: 'ready', items, ids: new Set(items.map((item) => item.profileId)) });
  } catch {
    if (state.ownerId === ownerId) setState({ status: 'error' });
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error || fallback;
}

/** 차단 — 성공하면 목록에 바로 넣는다(그 사람의 글·댓글이 곧바로 사라진다). */
export async function blockUser(user: { profileId: string; name: string; profileImage?: string | null }): Promise<void> {
  const res = await fetch('/api/blocks', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: user.profileId }),
  });
  if (!res.ok) throw new Error(await readError(res, '차단하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
  if (state.ids.has(user.profileId)) return;
  const item: BlockedUser = {
    profileId: user.profileId,
    name: user.name,
    profileImage: user.profileImage ?? null,
    blockedAt: new Date().toISOString(),
  };
  const ids = new Set(state.ids);
  ids.add(user.profileId);
  setState({ ids, items: [item, ...state.items] });
}

/** 차단 해제 */
export async function unblockUser(profileId: string): Promise<void> {
  const res = await fetch(`/api/blocks?profileId=${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await readError(res, '차단을 풀지 못했습니다. 잠시 후 다시 시도해 주세요.'));
  const ids = new Set(state.ids);
  ids.delete(profileId);
  setState({ ids, items: state.items.filter((item) => item.profileId !== profileId) });
}

/**
 * 내가 차단한 사람들. 로그인하지 않았으면 빈 목록.
 * ready 가 false 인 동안(처음 받는 중)에도 ids 는 빈 목록이라 화면은 평소처럼 그린다.
 */
export function useBlocks() {
  const { profile } = useAuth();
  const profileId = profile?.id ?? null;
  const snapshot = useSyncExternalStore(subscribe, () => state, () => EMPTY);

  useEffect(() => {
    if (profileId) void load(profileId);
    else if (state.ownerId) setState(EMPTY);
  }, [profileId]);

  const mine = snapshot.ownerId === profileId ? snapshot : EMPTY;
  return {
    ids: mine.ids,
    items: mine.items,
    ready: !profileId || mine.status === 'ready',
    error: mine.status === 'error',
    reload: () => (profileId ? load(profileId, true) : Promise.resolve()),
    myProfileId: profileId,
  };
}
