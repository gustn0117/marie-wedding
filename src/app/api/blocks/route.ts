import { NextResponse } from 'next/server';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';
import { readBoundedJson } from '@/lib/bounded-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BLOCKS = 1000;

/**
 * 이용자 차단(user_blocks, 서버 전용 표).
 * - GET: 내가 차단한 사람 목록(이름·사진 포함)
 * - POST { profileId }: 차단 — 그 사람의 글·댓글이 안 보이고 서로 쪽지를 주고받을 수 없다(쪽지는 DB 함수가 막는다)
 * - DELETE ?profileId=: 차단 해제
 * 호출자는 Supabase 가 확인한 세션으로만 정한다(브라우저가 고칠 수 있는 marie_profile 쿠키는 쓰지 않는다).
 */
export async function GET(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const me = await getVerifiedProfile(signal);
  if (!me.ok) return authError(me.reason);

  const service = createServiceClient(signal);
  const { data, error } = await service
    .from('user_blocks')
    .select('blocked_id, created_at, blocked:profiles!user_blocks_blocked_id_fkey(id, contact_name, company_name, profile_image, deleted_at)')
    .eq('blocker_id', me.profileId)
    .order('created_at', { ascending: false })
    .limit(MAX_BLOCKS);
  if (error) {
    console.error('[api/blocks] list failed:', error.message);
    return NextResponse.json({ error: '차단 목록을 불러오지 못했습니다.' }, { status: 500 });
  }

  type Row = {
    blocked_id: string;
    created_at: string;
    blocked: { contact_name: string | null; company_name: string | null; profile_image: string | null; deleted_at: string | null } | null;
  };
  const items = ((data ?? []) as unknown as Row[]).map((row) => ({
    profileId: row.blocked_id,
    blockedAt: row.created_at,
    name: row.blocked?.deleted_at ? '탈퇴한 회원' : (row.blocked?.company_name || row.blocked?.contact_name || '알 수 없음'),
    profileImage: row.blocked?.deleted_at ? null : (row.blocked?.profile_image ?? null),
  }));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const parsed = await readBoundedJson(request, 1024);
  const profileId = parsed.ok ? (parsed.value as { profileId?: unknown } | null)?.profileId : null;
  if (typeof profileId !== 'string' || !UUID_RE.test(profileId)) {
    return NextResponse.json({ error: '대상이 올바르지 않습니다.' }, { status: 400 });
  }

  const me = await getVerifiedProfile(signal);
  if (!me.ok) return authError(me.reason);
  if (me.profileId === profileId) {
    return NextResponse.json({ error: '본인은 차단할 수 없습니다.' }, { status: 400 });
  }

  const service = createServiceClient(signal);
  const { data: target } = await service.from('profiles').select('id').eq('id', profileId).maybeSingle();
  if (!target) return NextResponse.json({ error: '없는 사용자입니다.' }, { status: 404 });

  const { count } = await service
    .from('user_blocks')
    .select('blocked_id', { count: 'exact', head: true })
    .eq('blocker_id', me.profileId);
  if ((count ?? 0) >= MAX_BLOCKS) {
    return NextResponse.json({ error: `차단은 ${MAX_BLOCKS}명까지 할 수 있습니다.` }, { status: 400 });
  }

  // 이미 차단했으면 그대로 둔다(처음 차단한 시각 유지).
  const { error } = await service
    .from('user_blocks')
    .upsert({ blocker_id: me.profileId, blocked_id: profileId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) {
    console.error('[api/blocks] block failed:', error.message);
    return NextResponse.json({ error: '차단하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const profileId = new URL(request.url).searchParams.get('profileId');
  if (!profileId || !UUID_RE.test(profileId)) {
    return NextResponse.json({ error: '대상이 올바르지 않습니다.' }, { status: 400 });
  }

  const me = await getVerifiedProfile(signal);
  if (!me.ok) return authError(me.reason);

  const service = createServiceClient(signal);
  const { error } = await service
    .from('user_blocks')
    .delete()
    .eq('blocker_id', me.profileId)
    .eq('blocked_id', profileId);
  if (error) {
    console.error('[api/blocks] unblock failed:', error.message);
    return NextResponse.json({ error: '차단을 풀지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

function authError(reason: 'unauthorized' | 'profile_not_found' | 'timeout' | 'server_error') {
  if (reason === 'timeout') return NextResponse.json({ error: '응답이 늦어지고 있습니다. 다시 시도해 주세요.' }, { status: 504 });
  if (reason === 'server_error') return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 500 });
  return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
}
