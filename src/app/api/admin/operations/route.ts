import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { removeVerificationDocument } from '@/lib/verification-document';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODERATION_SCOPES = new Set(['job', 'post', 'comment', 'all']);
const MODERATION_ACTIONS = new Set(['hide', 'flag']);
const AUDIT_TABLES = new Set([
  'profiles',
  'jobs',
  'applications',
  'posts',
  'comments',
  'reviews',
  'reports',
  'payments',
  'banners',
]);
const AUDIT_ACTIONS = new Set(['insert', 'update', 'delete']);

type RequestBody = Record<string, unknown> & { action?: unknown };
type DatabaseError = { code?: string; message?: string };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function requiredUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return UUID_RE.test(normalized) ? normalized : null;
}

function databaseError(error: DatabaseError | null, fallback: string) {
  if (error?.code === '23505') return jsonError('이미 등록된 값입니다.', 409);
  return jsonError(error?.message || fallback, 500);
}

function koreaStartOfDayIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${value.year}-${value.month}-${value.day}T00:00:00+09:00`).toISOString();
}

export async function POST(request: NextRequest) {
  // 인증부터 DB 호출까지 요청 전체에 같은 deadline을 적용한다.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  if (!await isAdminRequest(signal)) {
    if (signal.aborted) return jsonError('관리자 인증 시간이 초과되었습니다.', 504);
    return jsonError('관리자 권한이 필요합니다.', 401);
  }

  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.action !== 'string') {
    return jsonError('잘못된 요청입니다.', 400);
  }
  if (signal.aborted) return jsonError('요청 시간이 초과되었습니다.', 504);

  const supabase = createServiceClient();

  try {
    switch (body.action) {
      case 'purgeUser': {
        const profileId = requiredUuid(body.profileId);
        if (!profileId) return jsonError('회원 ID가 올바르지 않습니다.', 400);

        const { data: target } = await supabase
          .from('profiles')
          .select('verification_document')
          .eq('id', profileId)
          .abortSignal(signal)
          .maybeSingle();
        const { error } = await supabase
          .rpc('purge_profile_cascade', { p_profile_id: profileId })
          .abortSignal(signal);
        if (signal.aborted) return jsonError('회원 삭제 시간이 초과되었습니다. 현재 상태를 다시 확인해 주세요.', 504);
        if (error) return databaseError(error, '회원을 삭제하지 못했습니다.');
        await removeVerificationDocument(target?.verification_document);
        return NextResponse.json({ ok: true });
      }

      case 'restoreUser': {
        const profileId = requiredUuid(body.profileId);
        if (!profileId || typeof body.restoreContent !== 'boolean') {
          return jsonError('회원 복원 요청이 올바르지 않습니다.', 400);
        }

        const { error } = await supabase
          .rpc('restore_profile_cascade', {
            p_profile_id: profileId,
            p_restore_content: body.restoreContent,
          })
          .abortSignal(signal);
        if (signal.aborted) return jsonError('회원 복원 시간이 초과되었습니다. 현재 상태를 다시 확인해 주세요.', 504);
        if (error) return databaseError(error, '회원을 복원하지 못했습니다.');
        return NextResponse.json({ ok: true });
      }

      case 'banUser': {
        const profileId = requiredUuid(body.profileId);
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (!profileId || !reason || reason.length > 1000) {
          return jsonError('회원 ID 또는 제재 사유가 올바르지 않습니다.', 400);
        }

        const { error } = await supabase
          .rpc('ban_user', { p_id: profileId, p_reason: reason })
          .abortSignal(signal);
        if (signal.aborted) return jsonError('회원 제재 시간이 초과되었습니다. 현재 상태를 다시 확인해 주세요.', 504);
        if (error) return databaseError(error, '회원을 제재하지 못했습니다.');
        return NextResponse.json({ ok: true });
      }

      case 'setAdminNote': {
        const profileId = requiredUuid(body.profileId);
        const note = typeof body.note === 'string' ? body.note.trim() : body.note;
        if (!profileId || (note !== null && typeof note !== 'string') || (typeof note === 'string' && note.length > 5000)) {
          return jsonError('관리자 메모 요청이 올바르지 않습니다.', 400);
        }

        const { error } = await supabase
          .rpc('set_admin_note', { p_id: profileId, p_note: note || null })
          .abortSignal(signal);
        if (signal.aborted) return jsonError('관리자 메모 저장 시간이 초과되었습니다. 현재 상태를 다시 확인해 주세요.', 504);
        if (error) return databaseError(error, '관리자 메모를 저장하지 못했습니다.');
        return NextResponse.json({ ok: true });
      }

      case 'unbanUser': {
        const profileId = requiredUuid(body.profileId);
        if (!profileId) return jsonError('회원 ID가 올바르지 않습니다.', 400);

        const { error } = await supabase
          .rpc('unban_user', { p_id: profileId })
          .abortSignal(signal);
        if (signal.aborted) return jsonError('제재 해제 시간이 초과되었습니다. 현재 상태를 다시 확인해 주세요.', 504);
        if (error) return databaseError(error, '제재를 해제하지 못했습니다.');
        return NextResponse.json({ ok: true });
      }

      case 'listModerationKeywords': {
        const { data, error } = await supabase
          .from('moderation_keywords')
          .select('id, keyword, scope, action, created_by, created_at')
          .order('created_at', { ascending: false })
          .abortSignal(signal);
        if (signal.aborted) return jsonError('키워드 조회 시간이 초과되었습니다.', 504);
        if (error) return databaseError(error, '키워드를 불러오지 못했습니다.');
        return NextResponse.json({ data: data ?? [] });
      }

      case 'addModerationKeyword': {
        const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
        const scope = typeof body.scope === 'string' ? body.scope : '';
        const moderationAction = typeof body.moderationAction === 'string' ? body.moderationAction : '';
        if (!keyword || keyword.length > 100 || !MODERATION_SCOPES.has(scope) || !MODERATION_ACTIONS.has(moderationAction)) {
          return jsonError('키워드, 적용 범위 또는 처리 방식이 올바르지 않습니다.', 400);
        }

        const row = {
          id: randomUUID(),
          keyword,
          scope,
          action: moderationAction,
          created_by: null,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from('moderation_keywords')
          .insert(row)
          .abortSignal(signal);
        if (signal.aborted) return jsonError('키워드 추가 시간이 초과되었습니다. 목록을 다시 확인해 주세요.', 504);
        if (error) return databaseError(error, '키워드를 추가하지 못했습니다.');
        return NextResponse.json({ data: row });
      }

      case 'deleteModerationKeyword': {
        const id = requiredUuid(body.id);
        if (!id) return jsonError('키워드 ID가 올바르지 않습니다.', 400);

        const { data, error } = await supabase
          .from('moderation_keywords')
          .delete()
          .eq('id', id)
          .select('id')
          .abortSignal(signal)
          .maybeSingle();
        if (signal.aborted) return jsonError('키워드 삭제 시간이 초과되었습니다. 목록을 다시 확인해 주세요.', 504);
        if (error) return databaseError(error, '키워드를 삭제하지 못했습니다.');
        if (!data) return jsonError('이미 삭제되었거나 존재하지 않는 키워드입니다.', 404);
        return NextResponse.json({ ok: true });
      }

      case 'getAuditLog': {
        const page = body.page;
        const table = typeof body.table === 'string' && body.table ? body.table : null;
        const changeAction = typeof body.changeAction === 'string' && body.changeAction ? body.changeAction : null;
        const recordId = typeof body.recordId === 'string' && body.recordId ? body.recordId.trim() : null;
        if (!Number.isInteger(page) || (page as number) < 1 || (page as number) > 100_000) {
          return jsonError('페이지 번호가 올바르지 않습니다.', 400);
        }
        if ((table && !AUDIT_TABLES.has(table)) || (changeAction && !AUDIT_ACTIONS.has(changeAction))) {
          return jsonError('감사 로그 필터가 올바르지 않습니다.', 400);
        }
        if (recordId && !UUID_RE.test(recordId)) {
          return jsonError('레코드 ID는 전체 UUID 형식으로 입력해 주세요.', 400);
        }

        const from = ((page as number) - 1) * PAGE_SIZE;
        let query = supabase
          .from('audit_log')
          .select('id, table_name, record_id, action, changed_by, old_data, new_data, changed_columns, changed_at, changer:profiles!changed_by(id, company_name, contact_name, profile_image)')
          .order('changed_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (table) query = query.eq('table_name', table);
        if (changeAction) query = query.eq('action', changeAction);
        if (recordId) query = query.eq('record_id', recordId);

        const { data, error } = await query.abortSignal(signal);
        if (signal.aborted) return jsonError('감사 로그 조회 시간이 초과되었습니다.', 504);
        if (error) return databaseError(error, '감사 로그를 불러오지 못했습니다.');
        return NextResponse.json({ data: data ?? [] });
      }

      case 'getReportStats': {
        const todayIso = koreaStartOfDayIso();
        const results = await Promise.all([
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').abortSignal(signal),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'reviewing').abortSignal(signal),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'resolved').abortSignal(signal),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'dismissed').abortSignal(signal),
          supabase.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', todayIso).abortSignal(signal),
        ]);
        if (signal.aborted) return jsonError('신고 통계 조회 시간이 초과되었습니다.', 504);
        const failed = results.find((result) => result.error)?.error ?? null;
        if (failed) return databaseError(failed, '신고 통계를 불러오지 못했습니다.');
        return NextResponse.json({
          data: {
            open: results[0].count ?? 0,
            reviewing: results[1].count ?? 0,
            resolved: results[2].count ?? 0,
            dismissed: results[3].count ?? 0,
            today: results[4].count ?? 0,
          },
        });
      }

      default:
        return jsonError('지원하지 않는 관리자 작업입니다.', 400);
    }
  } catch (error) {
    if (signal.aborted) return jsonError('요청 시간이 초과되었습니다.', 504);
    console.error('[admin/operations]', error);
    return jsonError('관리자 작업을 처리하지 못했습니다.', 500);
  }
}
