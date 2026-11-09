import { NextResponse } from 'next/server';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/shared/utils/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_IDS = 100;

type ViewSource = 'list' | 'detail';

/**
 * 공고자 확인 기록 — 공고 작성자가 받은 지원을 화면에서 본 시각을 남긴다(관리자 '지원 현황'용).
 *  source=list   공고 페이지 지원자 목록·마이페이지 받은 지원 목록에서 그 지원이 화면에 보였다
 *  source=detail 지원서 상세(제출 이력서)를 열었다
 *
 * 본인 공고에 들어온 지원만 기록하고 그 밖의 id 는 조용히 건너뛴다.
 * 기록은 application_views(서버 전용 표)에만 남기고 applications 행은 건드리지 않는다.
 */
export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  if (!caller.ok) {
    const status = caller.reason === 'timeout' ? 504 : caller.reason === 'server_error' ? 503 : 401;
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status });
  }
  if (!caller.onboardedAt || caller.bannedAt) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  let body: { applicationIds?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const source: ViewSource | null = body.source === 'list' || body.source === 'detail' ? body.source : null;
  const ids = Array.isArray(body.applicationIds)
    ? [...new Set(body.applicationIds.filter((id): id is string => typeof id === 'string' && isUuid(id)))]
    : [];
  if (!source || ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const service = createServiceClient(signal);

  // 본인 공고에 들어온, 삭제되지 않은 지원만 남긴다.
  const { data: owned, error: ownedError } = await service
    .from('applications')
    .select('id, job:jobs!inner(author_id)')
    .in('id', ids)
    .eq('job.author_id', caller.profileId)
    .is('deleted_at', null)
    .abortSignal(signal);
  if (ownedError) {
    console.error('[applications/viewed] ownership lookup failed:', ownedError.message);
    return NextResponse.json({ error: '기록하지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  }
  const allowed = (owned ?? []).map((row) => row.id as string);
  if (allowed.length === 0) return NextResponse.json({ ok: true, recorded: 0 });

  const now = new Date().toISOString();
  const opened = source === 'detail';

  // 1) 처음 보는 지원은 행을 만든다(이미 있으면 그대로 둬 첫 확인 시각을 지킨다).
  const { error: insertError } = await service
    .from('application_views')
    .upsert(
      allowed.map((applicationId) => ({
        application_id: applicationId,
        viewer_id: caller.profileId,
        first_seen_at: now,
        last_seen_at: now,
        detail_opened_at: opened ? now : null,
        detail_last_opened_at: opened ? now : null,
      })),
      { onConflict: 'application_id', ignoreDuplicates: true },
    )
    .abortSignal(signal);
  if (insertError) {
    console.error('[applications/viewed] insert failed:', insertError.message);
    return NextResponse.json({ error: '기록하지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  }

  // 2) 마지막 확인 시각과, 상세를 연 경우 상세 열람 시각을 갱신한다.
  const updates = [
    service
      .from('application_views')
      .update(opened
        ? { last_seen_at: now, detail_last_opened_at: now, viewer_id: caller.profileId }
        : { last_seen_at: now, viewer_id: caller.profileId })
      .in('application_id', allowed)
      .abortSignal(signal),
  ];
  if (opened) {
    updates.push(
      service
        .from('application_views')
        .update({ detail_opened_at: now })
        .in('application_id', allowed)
        .is('detail_opened_at', null)
        .abortSignal(signal),
    );
  }
  const results = await Promise.all(updates);
  const updateError = results.find((result) => result.error)?.error;
  if (updateError) {
    console.error('[applications/viewed] update failed:', updateError.message);
    return NextResponse.json({ error: '기록하지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  }

  return NextResponse.json({ ok: true, recorded: allowed.length });
}
