import { createHmac, randomBytes } from 'node:crypto';

// 팩스 어댑터 — 공급자 교체 가능 구조 (SMS 어댑터와 같은 패턴)
// 환경 변수 FAX_PROVIDER=console (개발) / solapi / popbill
//
// 솔라피는 실제 호출로 규격을 확인해 구현했다. 팝빌은 자리만 잡아둔 상태.
// 키는 서버 .env.production 에만 두고 저장소에는 절대 넣지 않는다.

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
 * 솔라피 — 팩스 1장당 100원(VAT 별도).
 * 필요한 환경변수: SOLAPI_API_KEY / SOLAPI_API_SECRET / FAX_SEND_NUMBER
 *
 * 절차(실제 호출로 확인한 규격):
 *  1) POST /storage/v1/files  { file: base64, type: 'FAX' } → fileId
 *  2) POST /messages/v4/send  { message: { to, from, type: 'FAX', faxOptions: { fileIds } } }
 *
 * 인증: Authorization: HMAC-SHA256 apiKey=..., date=..., salt=..., signature=HMAC_SHA256(date+salt, secret)
 */
class SolapiFaxAdapter implements FaxAdapter {
  readonly name = 'solapi';

  private authHeader(): string {
    const key = process.env.SOLAPI_API_KEY!;
    const secret = process.env.SOLAPI_API_SECRET!;
    const date = new Date().toISOString();
    const salt = randomBytes(16).toString('hex');
    const signature = createHmac('sha256', secret).update(date + salt).digest('hex');
    return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
  }

  async send(input: FaxSendInput): Promise<FaxSendResult> {
    const from = normalizeFaxNumber(process.env.FAX_SEND_NUMBER || '');
    if (!process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET) {
      return { ok: false, error: '솔라피 API 키가 설정되지 않았습니다.' };
    }
    if (!from) {
      return { ok: false, error: '발신번호(FAX_SEND_NUMBER)가 설정되지 않았습니다.' };
    }

    try {
      // 1) 문서를 내려받아 솔라피 저장소에 올린다(솔라피는 base64 업로드만 받는다).
      const fileRes = await fetch(input.fileUrl);
      if (!fileRes.ok) return { ok: false, error: '보낼 문서를 읽지 못했습니다.' };
      const base64 = Buffer.from(await fileRes.arrayBuffer()).toString('base64');

      const upRes = await fetch('https://api.solapi.com/storage/v1/files', {
        method: 'POST',
        headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, type: 'FAX', name: 'fax.pdf' }),
      });
      const upBody = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upBody.fileId) {
        return { ok: false, error: `문서 업로드 실패: ${upBody.errorMessage ?? upRes.status}` };
      }

      // 2) 발송
      const sendRes = await fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: { to: input.to, from, type: 'FAX', faxOptions: { fileIds: [upBody.fileId] } },
        }),
      });
      const sendBody = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) {
        return { ok: false, error: `발송 실패: ${sendBody.errorMessage ?? sendRes.status}` };
      }
      // 접수 실패가 200 안에 담겨 오는 경우(failedMessageList)도 실패로 본다.
      if (Array.isArray(sendBody.failedMessageList) && sendBody.failedMessageList.length > 0) {
        const first = sendBody.failedMessageList[0];
        return { ok: false, error: `발송 거부: ${first.statusMessage ?? first.statusCode ?? '알 수 없음'}` };
      }
      return { ok: true, providerId: sendBody.messageId ?? sendBody.groupId ?? undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : '발송 중 오류가 발생했습니다.' };
    }
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
