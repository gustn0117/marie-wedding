import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 8_000;

/**
 * 내 전체 프로필 조회 — 서버(service_role)로 확실히 반환.
 * 클라이언트 .from('profiles').select() 는 세션 토큰 준비 지연/RLS 로 실패해
 * 업종·소개 등 쿠키에 없는 필드가 비어 '초기화된 것처럼' 보이던 문제를 회피.
 */
export async function GET(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(requestSignal);
  if (!caller.ok) {
    if (caller.reason === 'timeout') {
      return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다.' }, { status: 504 });
    }
    if (caller.reason === 'server_error') {
      return NextResponse.json({ error: '로그인 정보를 확인하지 못했습니다.' }, { status: 503 });
    }
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabase = createServiceClient(requestSignal);
  const { data, error } = await supabase
    .from('profiles')
    // 자기 정보 전용 경로. 공개 column grant에서 제외한 연락처·인증 상태·소셜
    // 연결 정보도 검증된 세션 소유자에게만 반환한다. 관리자 메모/인증서 경로는 제외한다.
    .select('id, user_id, account_type, business_type, company_name, contact_name, region, signup_provider, onboarded_at, bio, phone, website, profile_image, cover_image, is_directory_listed, company_size, established_year, address, gallery, role, created_at, updated_at, deleted_at, verification_status, verification_submitted_at, verification_reviewed_at, verification_reject_reason, business_number, verified_at, phone_verified, phone_verified_at, response_rate, avg_response_minutes, completed_deals_count, premium_tier, premium_until, banned_at, banned_reason')
    .eq('id', caller.profileId)
    .abortSignal(requestSignal)
    .maybeSingle();

  if (error) {
    console.error('[api/profile/me] lookup failed:', error);
    return NextResponse.json(
      { error: requestSignal.aborted ? '프로필 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '프로필을 불러오지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }

  return NextResponse.json({ profile: data ?? null });
}
