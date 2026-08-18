import { NextResponse } from 'next/server';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 개인 회원 → 업체 회원 전환.
 *
 * account_type 만 바꾼다. 기존 데이터(이력서·지원 내역·게시글)는 그대로 남고,
 * 공고 등록은 이후 업체 프로필 완성 검사(/api/jobs/write)가 따로 지킨다.
 * 역방향(업체 → 개인)은 열지 않는다 — 운영 중인 공고의 수정 권한이
 * 업체 회원 검사에 걸려 스스로 잠기는 함정이 있어 고객센터를 거치게 한다.
 */
export async function POST() {
  const signal = AbortSignal.timeout(10_000);
  const viewer = await getVerifiedProfile(signal);
  if (!viewer.ok) {
    return NextResponse.json(
      { error: viewer.reason === 'timeout' ? '응답이 지연되고 있습니다. 다시 시도해주세요.' : '로그인이 필요합니다.' },
      { status: viewer.reason === 'timeout' ? 504 : 401 },
    );
  }
  if (viewer.bannedAt) {
    return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });
  }
  // 이미 업체면 그대로 성공 처리(중복 클릭·뒤로가기 재시도에 안전)
  if (viewer.accountType === 'business') {
    return NextResponse.json({ ok: true, already: true });
  }

  const service = createServiceClient(signal);
  const { data: updated, error } = await service
    .from('profiles')
    .update({ account_type: 'business', updated_at: new Date().toISOString() })
    .eq('id', viewer.profileId)
    .eq('account_type', 'individual')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[profile/convert-to-business] update failed:', error);
    return NextResponse.json({ error: '전환에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
  // 조건부 UPDATE 가 0행이면 그 사이 이미 전환된 것 — 성공으로 본다.
  return NextResponse.json({ ok: true, already: !updated });
}
