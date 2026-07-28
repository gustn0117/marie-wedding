import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';
import { readJobFields } from '@/lib/admin/job-fields';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 관리자 공고 수정 API — 등록 경로와 무관하게 모든 공고의 '내용'을 고친다.
 *
 * 소유권·상태 관련 값(author_id / status / featured_at / claim_code / 대행 정보)은
 * 여기서 건드리지 않는다. 내용 수정이 소유권 변경·인기 노출로 번지면 안 된다.
 * 대행 정보(동의 기록)는 전용 화면(/admin/proxy-jobs)에서만 다룬다.
 */

export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('*, author:profiles!jobs_author_id_fkey(id, company_name, contact_name)')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[api/admin/jobs] fetch failed:', error);
    return NextResponse.json({ error: '공고를 불러오지 못했습니다.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ job: data });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  if (body.action !== 'update') return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 });
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('jobs')
    .select('id, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
  if (existing.deleted_at) return NextResponse.json({ error: '삭제된 공고는 수정할 수 없습니다. 먼저 복원해주세요.' }, { status: 400 });

  const parsed = readJobFields(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { error } = await supabase
    .from('jobs')
    .update({ ...parsed.fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[api/admin/jobs] update failed:', error);
    return NextResponse.json({ error: `수정에 실패했습니다: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
