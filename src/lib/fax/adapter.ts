// 팩스 어댑터 — 공급자 교체 가능 구조 (SMS 어댑터와 같은 패턴)
// 환경 변수 FAX_PROVIDER=console (개발) / solapi / popbill
//
// 공급자 계약 전이라 실발송은 아직 붙어 있지 않다. 화면·DB·검증·수신거부까지
// 전부 동작하고, 키를 넣고 FAX_PROVIDER 만 바꾸면 실발송이 켜진다.

export interface FaxSendInput {
  /** 수신 팩스번호 — 숫자만 정규화된 값 */
  to: string;
  /** 표지 제목(문서 식별용) */
  subject: string;
  /** 보낼 문서의 공개 URL (PDF 또는 이미지) */
  fileUrl: string;
}

export interface FaxSendResult {
  ok: boolean;
  /** 공급자 응답 ID — 이후 상태 조회에 쓴다 */
  providerId?: string;
  error?: string;
}

export interface FaxAdapter {
  readonly name: string;
  send(input: FaxSendInput): Promise<FaxSendResult>;
}

/** 개발용 — 실제로 보내지 않고 로그만 남긴다. 운영에서는 거부한다. */
class ConsoleFaxAdapter implements FaxAdapter {
  readonly name = 'console';
  async send(input: FaxSendInput): Promise<FaxSendResult> {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        error: '팩스 공급자가 연결되지 않았습니다. FAX_PROVIDER 와 API 키를 설정해주세요.',
      };
    }
    console.log(`[FAX:console] to=${input.to} subject=${input.subject} file=${input.fileUrl}`);
    return { ok: true, providerId: `console-${Date.now()}` };
  }
}

/**
 * 솔라피 — 팩스 1장당 100원(2026-07 기준 공개 단가), 연동 비용 없음.
 * SOLAPI_API_KEY / SOLAPI_API_SECRET / FAX_SEND_NUMBER 필요.
 * 계약 후 실제 엔드포인트·서명 방식을 문서에 맞춰 채운다.
 */
class SolapiFaxAdapter implements FaxAdapter {
  readonly name = 'solapi';
  async send(): Promise<FaxSendResult> {
    return { ok: false, error: '솔라피 팩스 연동이 아직 구현되지 않았습니다. API 키 발급 후 연결해주세요.' };
  }
}

/**
 * 팝빌 — 팩스 전문. 연동신청 후 API Key 발급.
 * 발신번호를 사전등록하지 않으면 공용 발신번호가 쓰여 수신율이 떨어지므로 등록 권장.
 * POPBILL_LINK_ID / POPBILL_SECRET_KEY / POPBILL_CORP_NUM / FAX_SEND_NUMBER 필요.
 */
class PopbillFaxAdapter implements FaxAdapter {
  readonly name = 'popbill';
  async send(): Promise<FaxSendResult> {
    return { ok: false, error: '팝빌 팩스 연동이 아직 구현되지 않았습니다. API 키 발급 후 연결해주세요.' };
  }
}

export function getFaxAdapter(): FaxAdapter {
  switch (process.env.FAX_PROVIDER) {
    case 'solapi': return new SolapiFaxAdapter();
    case 'popbill': return new PopbillFaxAdapter();
    default: return new ConsoleFaxAdapter();
  }
}

/** 팩스번호 정규화 — 숫자만 남긴다. 02-708-4012 → 027084012 */
export function normalizeFaxNumber(raw: string): string {
  return (raw || '').replace(/[^0-9]/g, '');
}

/** 국내 팩스번호로 볼 수 있는 자릿수인지 (지역번호 포함 9~11자리) */
export function isValidFaxNumber(raw: string): boolean {
  const n = normalizeFaxNumber(raw);
  return n.length >= 9 && n.length <= 11 && n.startsWith('0');
}

/**
 * 광고성 팩스 야간 전송 제한 — 21:00~08:00(KST)는 별도 수신동의가 있어야 한다.
 * 상대 사무실 용지·토너를 소모시키는 매체라 분쟁 소지가 커 시스템에서 막는다.
 */
export function isWithinAllowedSendWindow(now: Date = new Date()): boolean {
  const kstHour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(now),
  );
  return kstHour >= 8 && kstHour < 21;
}
