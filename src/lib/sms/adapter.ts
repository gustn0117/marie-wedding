// SMS 어댑터 — Phase 5
// 실제 SMS 서비스(NHN Cloud Notification, NCP SENS 등) 연동은 본 어댑터를 통해 주입.
// 환경 변수 SMS_PROVIDER=console (기본) / nhn / ncp 으로 선택.

export interface SmsAdapter {
  send(to: string, body: string): Promise<void>;
}

class ConsoleSmsAdapter implements SmsAdapter {
  async send(to: string, body: string): Promise<void> {
    console.log(`[SMS:console] to=${to} body=${body}`);
  }
}

// NHN/NCP 등은 본 인터페이스를 구현해 환경 변수로 선택.
// e.g. SMS_PROVIDER=nhn 시 환경에 맞는 어댑터 인스턴스 생성.

let cached: SmsAdapter | null = null;

export function getSmsAdapter(): SmsAdapter {
  if (cached) return cached;
  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  switch (provider) {
    case 'console':
    default:
      cached = new ConsoleSmsAdapter();
  }
  return cached;
}
