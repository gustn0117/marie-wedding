import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { validateEmail } from '@/shared/utils/validation';

// ---------------------------------------------------------------------------
// In-memory 슬라이딩 윈도우 rate limiter
//
// 이 라우트는 미들웨어에서 /api/* 로 공개 우회되고 인증이 없다. service_role 로
// createUser(email_confirm:true) + profiles insert 를 수행하므로 무제한 호출 시
// 확인완료 유저/프로필이 무한 생성될 수 있다. 단일 standalone 인스턴스 배포라
// in-memory 카운터로 충분하다. (다중 인스턴스로 확장 시 Redis 등 공유 저장소 필요.)
//
// 주의: cloudflared 터널 뒤라 소켓 주소는 터널 IP다. 실제 클라이언트 IP는
// cf-connecting-ip → x-forwarded-for 첫 값 순으로 판별한다.
// ---------------------------------------------------------------------------

const IP_WINDOW_MS = 60_000; // 1분
const IP_MAX = 5; // IP당 분당 5회
const EMAIL_WINDOW_MS = 60_000; // 1분
const EMAIL_MAX = 2; // 동일 이메일 분당 2회

const CONTACT_NAME_MAX = 50;
const COMPANY_NAME_MAX = 100;

const ipHits = new Map<string, number[]>();
const emailHits = new Map<string, number[]>();

let lastSweep = Date.now();

/** 오래된 빈 엔트리를 주기적으로 제거해 Map 무한 증식을 막는다. */
function maybeSweep(now: number) {
  if (now - lastSweep < 5 * 60_000) return;
  lastSweep = now;
  ipHits.forEach((hits, key) => {
    if (hits.every((t) => t <= now - IP_WINDOW_MS)) ipHits.delete(key);
  });
  emailHits.forEach((hits, key) => {
    if (hits.every((t) => t <= now - EMAIL_WINDOW_MS)) emailHits.delete(key);
  });
}

/**
 * 슬라이딩 윈도우 소비. 한도 내면 현재 시각을 기록하고 true, 초과면 false.
 */
function consume(store: Map<string, number[]>, key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    store.set(key, hits);
    return false;
  }
  hits.push(now);
  store.set(key, hits);
  return true;
}

/** cloudflared 터널 뒤에서 실제 클라이언트 IP를 판별한다. */
function getClientIp(request: NextRequest): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    maybeSweep(Date.now());

    // IP 기준 rate limit (본문 파싱 전 선차단 — 잘못된 본문의 폭주도 함께 차단)
    const ip = getClientIp(request);
    if (!consume(ipHits, ip, IP_WINDOW_MS, IP_MAX)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { email, password, accountType, contactName, regions, businessTypes, companyName } = body;

    if (!email || !password || !contactName || !regions?.length) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
    }

    // 서버측 길이 상한 (schema.sql 이 TEXT 라 DB 제약 없음 — 과대 문자열 저장 방지)
    if (typeof contactName !== 'string' || contactName.length > CONTACT_NAME_MAX) {
      return NextResponse.json(
        { error: `담당자명은 ${CONTACT_NAME_MAX}자 이하로 입력해주세요.` },
        { status: 400 },
      );
    }
    if (companyName != null && (typeof companyName !== 'string' || companyName.length > COMPANY_NAME_MAX)) {
      return NextResponse.json(
        { error: `업체명은 ${COMPANY_NAME_MAX}자 이하로 입력해주세요.` },
        { status: 400 },
      );
    }

    // 이메일 형식 검증 (서버 측 — 클라이언트 우회 방지)
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json({ error: emailCheck.reason ?? '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    // 이메일 기준 rate limit (동일 이메일 대량 시도/열거 완화)
    const emailKey = String(email).trim().toLowerCase();
    if (!consume(emailHits, emailKey, EMAIL_WINDOW_MS, EMAIL_MAX)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    const supabase = createServiceClient();

    // 1. Create auth user (auto-confirmed with admin API)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: '회원가입에 실패했습니다.' }, { status: 500 });
    }

    // 2. Create profile (bypasses RLS with service_role)
    //    이메일 회원가입은 폼에서 이미 account_type / regions를 받았으므로 곧장 onboarded 상태로 저장.
    //    그러지 않으면 미들웨어가 마이페이지 진입 시 /onboarding으로 다시 보내 사용자가 동일 질문을 다시 받음.
    const profileData: Record<string, unknown> = {
      user_id: authData.user.id,
      account_type: accountType || 'individual',
      contact_name: contactName,
      region: Array.isArray(regions) ? regions.join(',') : regions,
      signup_provider: 'email',
      onboarded_at: new Date().toISOString(),
    };

    if (accountType === 'business') {
      profileData.business_type = Array.isArray(businessTypes) ? businessTypes.join(',') : businessTypes;
      profileData.company_name = companyName;
    }

    const { error: profileError } = await supabase.from('profiles').insert(profileData);

    if (profileError) {
      // Cleanup: delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `프로필 생성 실패: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
