import { NextResponse } from 'next/server';
import { isSmsEnabled } from '@/lib/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SMS(휴대폰 인증) 활성화 여부. 회원가입 폼이 이 값으로 인증 단계를 강제할지 결정한다.
 * NHN 키 미설정이면 false → 가입 시 휴대폰 인증을 요구하지 않는다(콘솔 폴백이라 코드가 안 옴).
 */
export async function GET() {
  return NextResponse.json({ enabled: isSmsEnabled() });
}
