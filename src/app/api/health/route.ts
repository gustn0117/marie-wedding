import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 무중단 배포용 헬스 체크.
 *
 * 의도적으로 "얕게" 만든다 — Next 프로세스가 라우트를 실제로 처리할 수 있는지만
 * 확인한다. Supabase·SMTP 같은 외부 의존성까지 검사하면 DB가 잠깐 느린 순간에
 * 멀쩡한 배포가 실패하고, 반대로 이미 서비스 중인 컨테이너가 unhealthy 로
 * 뒤집혀 교체 대상이 되어버린다.
 */
export function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
