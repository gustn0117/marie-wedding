import { NextResponse } from 'next/server';
import { isSmsEnabled } from '@/lib/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 회원가입 인증 방법 가용성.
 * - email: 항상 사용 가능(자체 SMTP 발송 연동됨)
 * - phone: NHN SMS 키 설정 시에만(isSmsEnabled). 미설정이면 폼에서 '준비중' 처리.
 * enabled 는 하위호환(휴대폰 인증 활성 여부).
 */
export async function GET() {
  const phone = isSmsEnabled();
  return NextResponse.json({ email: true, phone, enabled: phone });
}
