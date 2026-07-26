import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 대행 등록 공고 가져가기(claim).
 *
 * 관리자가 업체 동의를 받아 대신 올린 공고를, 그 업체가 가입한 뒤 코드를 입력해
 * 자기 계정으로 가져간다. 코드는 관리자가 업체에 직접 전달한다(팩스·전화·메일).
 *
 * 업체명 자동 매칭은 일부러 넣지 않았다. 이름이 비슷한 다른 업체가 남의 공고를
 * 가져가면 되돌리기 어렵고, 그 공고로 들어온 지원서까지 넘어간다.
 */
export async function POST(request: Request) {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (viewer.bannedAt) return NextResponse.json({ error: '이용이 제한된 계정입니다.' }, { status: 403 });
  if (viewer.accountType !== 'business') {
    return NextResponse.json({ error: '업체 회원만 공고를 가져갈 수 있습니다.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  // 입력 편의: 공백·소문자·하이픈 유무를 흡수한다.
  const raw = typeof body.code === 'string' ? body.code : '';
  const normalized = raw.replace(/[\s-]/g, '').toUpperCase();
  if (normalized.length !== 8) {
    return NextResponse.json({ error: '코드는 8자리입니다. 다시 확인해주세요.' }, { status: 400 });
  }
  const code = `${normalized.slice(0, 4)}-${normalized.slice(4)}`;

  const supabase = createServiceClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, author_id, proxy_company_name, deleted_at')
    .eq('claim_code', code)
    .maybeSingle();

  if (!job || job.deleted_at) {
    return NextResponse.json({ error: '유효하지 않은 코드입니다.' }, { status: 404 });
  }
  if (job.author_id) {
    return NextResponse.json({ error: '이미 다른 계정이 가져간 공고입니다.' }, { status: 409 });
  }

  // author_id 가 비어 있을 때만 갱신 — 동시에 두 명이 입력해도 한 명만 성공한다.
  const { data: updated, error } = await supabase
    .from('jobs')
    .update({ author_id: viewer.profileId, claimed_at: new Date().toISOString(), claim_code: null })
    .eq('id', job.id)
    .is('author_id', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[api/jobs/claim] failed:', error);
    return NextResponse.json({ error: '가져오기에 실패했습니다.' }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: '이미 다른 계정이 가져간 공고입니다.' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, jobId: job.id, title: job.title });
}
