import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

/** 외부 SMS/메일 발송 실패 시 방금 발급한 OTP만 지워 cooldown을 즉시 해제한다. */
export async function removeIssuedOtp(table: 'phone_otps' | 'email_otps', otpId: string) {
  const signal = AbortSignal.timeout(3_000);
  try {
    const client = createServiceClient(signal);
    const { error } = await client
      .from(table)
      .delete()
      .eq('id', otpId)
      .abortSignal(signal);
    if (error) console.error(`[otp] failed to remove unsent ${table} row:`, error.message);
  } catch (error) {
    console.error(`[otp] failed to clean up unsent ${table} row:`, error);
  }
}
