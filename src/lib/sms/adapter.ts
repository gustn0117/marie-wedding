// SMS 어댑터 — Phase 5
// 실제 SMS 서비스(NHN Cloud Notification, NCP SENS 등) 연동은 본 어댑터를 통해 주입.
// 환경 변수 SMS_PROVIDER=console (개발만) / nhn / ncp 으로 선택.

export interface SmsAdapter {
  send(to: string, body: string): Promise<void>;
}

class ConsoleSmsAdapter implements SmsAdapter {
  async send(to: string, body: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      // 운영에서는 절대 콘솔에 인증번호를 남기지 않는다.
      throw new Error('SMS_PROVIDER=console is not allowed in production. Configure nhn/ncp adapter.');
    }
    console.log(`[SMS:console] to=${to} body=${body}`);
  }
}

class NotImplementedAdapter implements SmsAdapter {
  constructor(private name: string) {}
  async send(): Promise<void> {
    throw new Error(`SMS provider "${this.name}" is not implemented yet. Add an adapter in src/lib/sms/adapter.ts.`);
  }
}

let cached: SmsAdapter | null = null;

export function getSmsAdapter(): SmsAdapter {
  if (cached) return cached;
  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  switch (provider) {
    case 'console':
      cached = new ConsoleSmsAdapter();
      break;
    case 'nhn':
    case 'ncp':
    default:
      cached = new NotImplementedAdapter(provider);
  }
  return cached;
}
