import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { validateEmail } from '@/shared/utils/validation';
import { isSmsEnabled, normalizePhone, isValidPhone } from '@/lib/otp';
import { sendEmail } from '@/features/notifications/lib/email';
import { welcomeEmail } from '@/features/notifications/lib/templates';

// 인증 완료 후 회원가입까지 허용하는 시간 (인증 완료 → 가입 폼 제출)
const PHONE_VERIFY_WINDOW_MS = 30 * 60 * 1000; // 30분
const EMAIL_VERIFY_WINDOW_MS = 30 * 60 * 1000; // 30분

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
const REQUEST_TIMEOUT_MS = 20_000;
const OTP_CLAIM_SECONDS = 60;

type SignupOtpClaim = {
  method: 'phone' | 'email';
  otpId: string;
  token: string;
};

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

async function consumeSignupOtp(claim: SignupOtpClaim): Promise<boolean> {
  // 응답 유실 뒤 같은 token으로 재호출해도 DB 함수가 idempotent하게 true를
  // 반환한다. 요청 전체 deadline과 분리해 이미 만든 계정의 OTP 소비를 끝낸다.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const client = createServiceClient(AbortSignal.timeout(5_000));
      const { data, error } = await client.rpc('consume_signup_otp_atomic', {
        p_method: claim.method,
        p_otp_id: claim.otpId,
        p_claim_token: claim.token,
      });
      if (!error) return data === true;
      console.error('[signup] OTP consume failed:', error.message);
    } catch (error) {
      console.error('[signup] OTP consume request failed:', error);
    }
  }
  return false;
}

async function releaseSignupOtp(claim: SignupOtpClaim) {
  try {
    const client = createServiceClient(AbortSignal.timeout(5_000));
    const { error } = await client.rpc('release_signup_otp_claim', {
      p_method: claim.method,
      p_otp_id: claim.otpId,
      p_claim_token: claim.token,
    });
    if (error) console.error('[signup] OTP claim release failed:', error.message);
  } catch (error) {
    console.error('[signup] OTP claim release request failed:', error);
  }
}

async function deleteSignupUser(userId: string): Promise<boolean> {
  try {
    const client = createServiceClient(AbortSignal.timeout(5_000));
    const { error } = await client.auth.admin.deleteUser(userId);
    if (!error) return true;
    console.error('[signup] orphan auth user cleanup failed:', error.message);
  } catch (error) {
    console.error('[signup] orphan auth user cleanup request failed:', error);
  }
  return false;
}

async function signupProfileStillExists(userId: string): Promise<boolean | null> {
  try {
    const client = createServiceClient(AbortSignal.timeout(5_000));
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[signup] compensation state lookup failed:', error.message);
      return null;
    }
    return Boolean(data);
  } catch (error) {
    console.error('[signup] compensation state lookup request failed:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  let createdUserId: string | null = null;
  let profileCreated = false;
  let otpClaim: SignupOtpClaim | null = null;
  let otpConsumed = false;
  let releaseOtpOnExit = true;

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
    const { email, password, accountType, contactName, regions, businessTypes, companyName, phone, verifyMethod } = body;

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

    const supabase = createServiceClient(signal);

    // 0. 본인 인증 확인 — 이메일 또는 휴대폰 중 선택한 방법을 검증한다.
    const phoneDigits = normalizePhone(phone);
    const smsOn = isSmsEnabled();
    const method = verifyMethod === 'phone' ? 'phone' : 'email';
    let phoneWasVerified = false;
    const otpIdentifier = method === 'phone' ? phoneDigits : emailKey;

    if (method === 'phone') {
      // 휴대폰 인증 (SMS 활성화 시에만 가능)
      if (!smsOn) {
        return NextResponse.json({ error: '휴대폰 인증은 현재 준비중입니다. 이메일 인증을 이용해주세요.' }, { status: 400 });
      }
      if (!isValidPhone(phoneDigits)) {
        return NextResponse.json({ error: '휴대폰 인증을 완료해주세요.' }, { status: 400 });
      }
    }

    const claimToken = crypto.randomUUID();
    const verifyWindowMs = method === 'phone' ? PHONE_VERIFY_WINDOW_MS : EMAIL_VERIFY_WINDOW_MS;
    const { data: claimData, error: claimError } = await supabase.rpc('claim_signup_otp_atomic', {
      p_method: method,
      p_identifier: otpIdentifier,
      p_claim_token: claimToken,
      p_verify_window_seconds: Math.floor(verifyWindowMs / 1000),
      p_claim_seconds: OTP_CLAIM_SECONDS,
    });
    if (claimError) {
      if (signal.aborted) throw claimError;
      console.error('[signup] OTP claim failed:', claimError.message);
      return NextResponse.json({ error: '인증 상태 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
    }
    const claimResult = Array.isArray(claimData) ? claimData[0] : null;
    if (!claimResult?.otp_id || claimResult.claim_status !== 'claimed') {
      const inProgress = claimResult?.claim_status === 'in_progress';
      return NextResponse.json(
        { error: inProgress ? '동일한 인증 정보로 회원가입을 처리 중입니다.' : `${method === 'phone' ? '휴대폰' : '이메일'} 인증을 다시 완료해주세요.` },
        { status: inProgress ? 409 : 400 },
      );
    }
    otpClaim = { method, otpId: claimResult.otp_id, token: claimToken };
    phoneWasVerified = method === 'phone';

    // 1. Create auth user (auto-confirmed with admin API)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (signal.aborted) throw authError;
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: '회원가입에 실패했습니다.' }, { status: 500 });
    }
    createdUserId = authData.user.id;

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

    // 휴대폰: 휴대폰 인증을 통과했으면 verified 로, 아니면 입력값만(선택) 저장.
    if (phoneDigits && isValidPhone(phoneDigits)) {
      profileData.phone = phoneDigits;
      if (phoneWasVerified) {
        profileData.phone_verified = true;
        profileData.phone_verified_at = new Date().toISOString();
      }
    }

    if (accountType === 'business') {
      profileData.business_type = Array.isArray(businessTypes) ? businessTypes.join(',') : businessTypes;
      profileData.company_name = companyName;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profileData)
      .abortSignal(signal);

    if (profileError) {
      throw new Error(`프로필 생성 실패: ${profileError.message}`);
    }
    // 프로필까지 만들어진 뒤 claim한 OTP를 원자적으로 소비한다. 단순 DELETE와
    // 달리 동시 요청이 같은 verified 행을 재사용할 수 없고 감사 흔적도 남는다.
    if (!otpClaim || !await consumeSignupOtp(otpClaim)) {
      throw new Error('인증 상태 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    otpConsumed = true;
    profileCreated = true;

    // 환영 메일은 회원가입 응답을 막지 않는다. 자체 호스팅 Node 프로세스에서
    // best-effort로 보내며 실패는 로그만 남긴다.
    void (async () => {
      const { subject, html, text } = welcomeEmail(contactName);
      const result = await sendEmail({ to: email, subject, html, text });
      if (!result.ok) console.error('[signup] welcome email failed:', result.error);
    })().catch((mailErr) => console.error('[signup] welcome email failed:', mailErr));

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (err) {
    // Auth 생성 뒤 프로필 저장이 끊겼다면 고아 계정을 독립된 짧은 deadline으로 정리한다.
    if (createdUserId && !profileCreated) {
      const userId = createdUserId;
      const deleted = await deleteSignupUser(userId);
      if (deleted) {
        createdUserId = null;
      } else {
        // deleteUser는 오류를 throw하지 않고 { error }로 반환할 수도 있다. 이때
        // claim을 풀면 계정/프로필이 남은 채 OTP가 재사용된다. 먼저 OTP를 terminal
        // 소비하고, 실제 profile도 남아 있으면 이미 만들어진 가입을 성공으로 복구한다.
        releaseOtpOnExit = false;
        if (otpClaim && !otpConsumed) otpConsumed = await consumeSignupOtp(otpClaim);
        // INSERT 응답이 timeout으로 유실됐을 수도 있으므로 로컬 플래그를 믿지
        // 않고 DB에서 실제 profile 생존 여부를 다시 확인한다.
        const profileSurvived = await signupProfileStillExists(userId);
        if (profileSurvived && otpConsumed) {
          profileCreated = true;
          return NextResponse.json({ success: true, userId, recovered: true });
        }
      }
    }
    if (signal.aborted) {
      return NextResponse.json(
        { error: '회원가입 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.' },
        { status: 504 },
      );
    }
    const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (otpClaim && !otpConsumed && releaseOtpOnExit) await releaseSignupOtp(otpClaim);
  }
}
