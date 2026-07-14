import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/shared/utils/uuid';
import { sameNullableTimestamp } from '@/shared/utils/idempotency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUERY_TIMEOUT_MS = 10_000;
const IMAGE_PATH_RE = /^(pc|mobile)\/[a-zA-Z0-9._-]+$/;

interface BannerInput {
  title?: string;
  image_path_pc?: string | null;
  image_path_mobile?: string | null;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
}

function errorResponse(error: unknown, signal: AbortSignal) {
  if (signal.aborted) {
    return NextResponse.json({ error: '배너 서버 응답이 지연되고 있습니다. 다시 시도해 주세요.' }, { status: 504 });
  }
  const message = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '배너 요청을 처리하지 못했습니다.';
  return NextResponse.json({ error: message }, { status: 500 });
}

function validateImagePath(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && IMAGE_PATH_RE.test(value));
}

function parseInput(raw: unknown, partial: boolean): { input?: BannerInput; error?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: '잘못된 요청입니다.' };
  const source = raw as Record<string, unknown>;
  const input: BannerInput = {};

  if ('title' in source) {
    if (typeof source.title !== 'string' || !source.title.trim() || source.title.trim().length > 120) {
      return { error: '배너 제목은 1~120자로 입력해 주세요.' };
    }
    input.title = source.title.trim();
  } else if (!partial) {
    return { error: '배너 제목을 입력해 주세요.' };
  }

  for (const key of ['image_path_pc', 'image_path_mobile'] as const) {
    if (key in source) {
      if (!validateImagePath(source[key])) return { error: '배너 이미지 경로가 올바르지 않습니다.' };
      input[key] = source[key] as string | null;
    }
  }

  if ('link_url' in source) {
    if (source.link_url !== null && (typeof source.link_url !== 'string' || source.link_url.length > 2000)) {
      return { error: '링크 URL이 올바르지 않습니다.' };
    }
    input.link_url = typeof source.link_url === 'string' ? source.link_url.trim() || null : null;
  }
  if ('display_order' in source) {
    if (typeof source.display_order !== 'number' || !Number.isSafeInteger(source.display_order)) {
      return { error: '노출 순서가 올바르지 않습니다.' };
    }
    input.display_order = source.display_order;
  }
  if ('is_active' in source) {
    if (typeof source.is_active !== 'boolean') return { error: '활성 상태가 올바르지 않습니다.' };
    input.is_active = source.is_active;
  }
  for (const key of ['valid_from', 'valid_until'] as const) {
    if (key in source) {
      const value = source[key];
      if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) {
        return { error: '노출 기간이 올바르지 않습니다.' };
      }
      input[key] = value as string | null;
    }
  }

  return { input };
}

async function authorize(signal: AbortSignal) {
  return isAdminRequest(signal);
}

export async function GET(request: NextRequest) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(QUERY_TIMEOUT_MS)]);
  if (!await authorize(signal)) return signal.aborted
    ? NextResponse.json({ error: '관리자 인증 시간이 초과되었습니다.' }, { status: 504 })
    : NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const service = createServiceClient();
  const { data, error } = await service
    .from('banners')
    .select('*')
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })
    .abortSignal(signal);
  if (error) return errorResponse(error, signal);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(QUERY_TIMEOUT_MS)]);
  if (!await authorize(signal)) return signal.aborted
    ? NextResponse.json({ error: '관리자 인증 시간이 초과되었습니다.' }, { status: 504 })
    : NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown; input?: unknown } | null;
  const bannerId = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!isUuid(bannerId)) return NextResponse.json({ error: '유효한 생성 ID가 필요합니다.' }, { status: 400 });
  const parsed = parseInput(body?.input, false);
  if (!parsed.input) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const createInput = {
    id: bannerId,
    title: parsed.input.title!,
    image_path_pc: parsed.input.image_path_pc ?? null,
    image_path_mobile: parsed.input.image_path_mobile ?? null,
    link_url: parsed.input.link_url ?? null,
    display_order: parsed.input.display_order ?? 0,
    is_active: parsed.input.is_active ?? true,
    valid_from: parsed.input.valid_from ?? null,
    valid_until: parsed.input.valid_until ?? null,
  };

  const service = createServiceClient();
  const { data, error } = await service
    .from('banners')
    .insert(createInput)
    .select('*')
    .abortSignal(signal)
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: replayError } = await service
        .from('banners')
        .select('*')
        .eq('id', bannerId)
        .is('deleted_at', null)
        .abortSignal(signal)
        .maybeSingle();
      if (replayError) return errorResponse(replayError, signal);
      const sameContext = !!existing && !existing.deleted_at;
      const exactReplay = sameContext
        && existing.title === createInput.title
        && existing.image_path_pc === createInput.image_path_pc
        && existing.image_path_mobile === createInput.image_path_mobile
        && existing.link_url === createInput.link_url
        && existing.display_order === createInput.display_order
        && existing.is_active === createInput.is_active
        && sameNullableTimestamp(existing.valid_from, createInput.valid_from)
        && sameNullableTimestamp(existing.valid_until, createInput.valid_until);
      if (exactReplay) return NextResponse.json({ data: existing, replayed: true });
      if (sameContext) {
        return NextResponse.json({
          error: '같은 생성 ID로 이미 다른 내용의 배너가 등록되었습니다. 기존에 생성된 배너를 확인한 뒤 해당 항목을 수정해주세요.',
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          existingImagePaths: {
            pc: existing.image_path_pc,
            mobile: existing.image_path_mobile,
          },
        }, { status: 409 });
      }
      return NextResponse.json({ error: '이미 사용된 생성 ID입니다.' }, { status: 409 });
    }
    return errorResponse(error, signal);
  }
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(QUERY_TIMEOUT_MS)]);
  if (!await authorize(signal)) return signal.aborted
    ? NextResponse.json({ error: '관리자 인증 시간이 초과되었습니다.' }, { status: 504 })
    : NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown; input?: unknown } | null;
  if (typeof body?.id !== 'string' || !body.id) {
    return NextResponse.json({ error: '배너 ID가 필요합니다.' }, { status: 400 });
  }
  const parsed = parseInput(body.input, true);
  if (!parsed.input || Object.keys(parsed.input).length === 0) {
    return NextResponse.json({ error: parsed.error || '수정할 값이 없습니다.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('banners')
    .update(parsed.input)
    .eq('id', body.id)
    .is('deleted_at', null)
    .select('*')
    .abortSignal(signal)
    .maybeSingle();
  if (error) return errorResponse(error, signal);
  if (!data) return NextResponse.json({ error: '배너를 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(QUERY_TIMEOUT_MS)]);
  if (!await authorize(signal)) return signal.aborted
    ? NextResponse.json({ error: '관리자 인증 시간이 초과되었습니다.' }, { status: 504 })
    : NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (typeof body?.id !== 'string' || !body.id) {
    return NextResponse.json({ error: '배너 ID가 필요합니다.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('banners')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', body.id)
    .is('deleted_at', null)
    .select('id')
    .abortSignal(signal)
    .maybeSingle();
  if (error) return errorResponse(error, signal);
  if (!data) return NextResponse.json({ error: '배너를 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
