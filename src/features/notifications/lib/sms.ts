/**
 * NHN Cloud SMS wrapper (server-only).
 * 환경변수 미설정 시 console.log fallback.
 *
 * https://docs.nhncloud.com/ko/Notification/SMS/ko/api-guide/
 */

interface SendSmsInput {
  to: string;          // 'E.164 or 010-1234-5678' — NHN은 다양한 포맷 수용
  body: string;        // 90자 미만 권장 (SMS), 90자 초과 시 LMS 자동
  title?: string;      // LMS/MMS에서만 사용
}

export async function sendSms(input: SendSmsInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sendNo = process.env.NHN_SMS_SEND_NO;

  if (!appKey || !secretKey || !sendNo || appKey.includes('your-')) {
    console.log('[sms:dev]', { to: input.to, body: input.body.slice(0, 50) });
    return { ok: true, id: 'dev-skip' };
  }

  const isLms = input.body.length > 90;
  const endpoint = `https://api-sms.cloud.toast.com/sms/v3.0/appKeys/${appKey}/sender/${isLms ? 'lms' : 'sms'}`;
  const recipientNo = input.to.replace(/[^0-9]/g, '');

  const body = {
    body: input.body,
    sendNo,
    recipientList: [{ recipientNo }],
    ...(isLms ? { title: input.title || '[Marié] 알림' } : {}),
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': secretKey,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.header?.isSuccessful) {
      return { ok: false, error: json.header?.resultMessage || `HTTP ${res.status}` };
    }
    return { ok: true, id: json.body?.data?.requestId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'send failed' };
  }
}
