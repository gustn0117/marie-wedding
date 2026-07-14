import crypto from 'crypto';

/** SMS 인증이 실제로 활성화됐는지 (NHN 키 설정 여부). 미설정 시 회원가입에서 강제하지 않는다. */
export function isSmsEnabled(): boolean {
  return (process.env.SMS_PROVIDER || '').toLowerCase() === 'nhn'
    && !!process.env.NHN_SMS_APP_KEY
    && !process.env.NHN_SMS_APP_KEY.includes('your-');
}

export function normalizePhone(input: unknown): string {
  return typeof input === 'string' ? input.replace(/[^0-9]/g, '') : '';
}

export function isValidPhone(digits: string): boolean {
  return /^01[0-9]{7,8}[0-9]$/.test(digits); // 010xxxxxxxx (10~11자리)
}

/** phone+code 를 HMAC-SHA256 으로 해시 (평문 코드 미저장). */
export function hashOtp(phone: string, code: string): string {
  const secret = process.env.OTP_HASH_SALT
    || process.env.OTP_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'marie-otp-secret';
  return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

export function generateOtpCode(): string {
  // 6자리 (crypto 기반)
  return String(crypto.randomInt(100000, 1000000));
}
