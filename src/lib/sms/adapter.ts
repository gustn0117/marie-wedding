// SMS 어댑터 — OTP/알림 발송
// 환경 변수 SMS_PROVIDER=console (dev만) / nhn (운영)

import { sendSms as sendNhnSms } from '@/features/notifications/lib/sms';

export interface SmsAdapter {
  send(to: string, body: string): Promise<void>;
}

class ConsoleSmsAdapter implements SmsAdapter {
  async send(to: string, body: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS_PROVIDER=console is not allowed in production. Set SMS_PROVIDER=nhn.');
    }
    console.log(`[SMS:console] to=${to} body=${body}`);
  }
}

/**
 * NHN Cloud SMS 어댑터 — Milestone 2.3에서 만든 sendSms() 재사용.
 * NHN_SMS_APP_KEY/SECRET_KEY/SEND_NO 미설정 시 sendSms가 자체 fallback (콘솔 출력).
 */
class NhnSmsAdapter implements SmsAdapter {
  async send(to: string, body: string): Promise<void> {
    const result = await sendNhnSms({ to, body });
    if (!result.ok) {
      throw new Error(result.error ?? 'NHN SMS send failed');
    }
  }
}

let cached: SmsAdapter | null = null;

export function getSmsAdapter(): SmsAdapter {
  if (cached) return cached;
  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  switch (provider) {
    case 'nhn':
      cached = new NhnSmsAdapter();
      break;
    case 'console':
    default:
      cached = new ConsoleSmsAdapter();
  }
  return cached;
}
