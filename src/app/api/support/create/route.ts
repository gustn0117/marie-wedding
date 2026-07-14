import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { isUuid } from '@/shared/utils/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * 고객센터 문의 접수 — support_inquiries 에 저장(service_role).
 * 비로그인도 가능. 로그인 상태면 profile_id 연결.
 */
export async function POST(req: Request) {
  const requestSignal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  try {
    const { id, name, phone, email, message } = await req.json().catch(() => ({}));
    const inquiryId = typeof id === 'string' ? id.trim() : '';
    if (!isUuid(inquiryId)) {
      return NextResponse.json({ error: '유효한 접수 ID가 필요합니다.' }, { status: 400 });
    }
    const msg = typeof message === 'string' ? message.trim() : '';
    if (!msg) return NextResponse.json({ error: '문의 내용을 입력해주세요.' }, { status: 400 });
    if (msg.length > 5000) return NextResponse.json({ error: '문의 내용이 너무 깁니다. (5000자 이하)' }, { status: 400 });

    const phoneVal = typeof phone === 'string' ? phone.trim() : '';
    const emailVal = typeof email === 'string' ? email.trim() : '';
    if (!phoneVal && !emailVal) {
      return NextResponse.json({ error: '연락받을 전화번호나 이메일 중 하나는 입력해주세요.' }, { status: 400 });
    }

    // 비로그인 문의는 허용하되, 회원 귀속은 검증된 Supabase 세션이 있을 때만 한다.
    const caller = await getVerifiedProfile(requestSignal);
    const profileId = caller.ok ? caller.profileId : null;
    if (!caller.ok && (caller.reason === 'timeout' || caller.reason === 'server_error')) {
      console.error(`[api/support/create] profile association skipped: ${caller.reason}`);
    }

    const supabase = createServiceClient(requestSignal);
    const createInput = {
      id: inquiryId,
      profile_id: profileId,
      name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : null,
      phone: phoneVal ? phoneVal.slice(0, 40) : null,
      email: emailVal ? emailVal.slice(0, 200) : null,
      message: msg.slice(0, 5000),
    };
    const { error } = await supabase
      .from('support_inquiries')
      .insert(createInput)
      .abortSignal(requestSignal);
    if (error) {
      if (error.code === '23505') {
        const { data: existing, error: replayError } = await supabase
          .from('support_inquiries')
          .select('id, profile_id, name, phone, email, message')
          .eq('id', inquiryId)
          .abortSignal(requestSignal)
          .maybeSingle();
        if (replayError) {
          return NextResponse.json(
            { error: requestSignal.aborted ? '문의 접수 결과 확인이 지연되고 있습니다.' : '문의 접수 결과를 확인하지 못했습니다.' },
            { status: requestSignal.aborted ? 504 : 500 },
          );
        }
        const exactReplay = !!existing
          && existing.profile_id === createInput.profile_id
          && existing.name === createInput.name
          && existing.phone === createInput.phone
          && existing.email === createInput.email
          && existing.message === createInput.message;
        if (exactReplay) return NextResponse.json({ ok: true, replayed: true });
        return NextResponse.json({
          error: '같은 접수 ID로 이미 다른 문의가 등록되었습니다. 문의 내역을 확인해주세요.',
        }, { status: 409 });
      }
      console.error('[api/support/create] insert error:', error.message);
      return NextResponse.json(
        { error: requestSignal.aborted ? '문의 접수 시간이 초과되었습니다. 접수 여부를 확인한 뒤 다시 시도해주세요.' : '문의 접수에 실패했습니다.' },
        { status: requestSignal.aborted ? 504 : 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/support/create] failed:', err);
    return NextResponse.json(
      { error: requestSignal.aborted ? '문의 접수 시간이 초과되었습니다. 다시 시도해주세요.' : '문의 접수에 실패했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
}
