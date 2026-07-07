/**
 * 사용자용 에러 메시지 유틸.
 *
 * 원칙:
 *  - Supabase/PostgREST/RLS/DB 원문 문자열이 UI 로 새어나가지 않게 매핑.
 *  - HTTP status code, PGRST106 같은 내부 코드 노출 금지.
 *  - 재시도 가능 여부·후속 조치를 짧게 안내.
 */
export function friendlyError(err: unknown, fallback = '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'): string {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!msg) return fallback;

  const lower = msg.toLowerCase();

  // 네트워크 / 타임아웃
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return '네트워크 연결이 불안정해요. 인터넷 상태를 확인하고 다시 시도해주세요.';
  }
  if (lower.includes('timeout') || lower.includes('시간이 초과') || lower.includes('지연')) {
    return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.';
  }
  if (lower.includes('abort')) {
    return '요청이 중단되었어요. 다시 시도해주세요.';
  }

  // 인증 / 권한
  if (lower.includes('unauthorized') || lower.includes('jwt') || lower.includes('로그인이 필요')) {
    return '로그인이 필요해요. 다시 로그인해주세요.';
  }
  if (lower.includes('permission') || lower.includes('권한') || lower.includes('rls') || lower.includes('policy')) {
    return '권한이 없어요. 본인 계정으로 다시 시도해주세요.';
  }
  if (lower.includes('forbidden')) {
    return '허용되지 않은 작업이에요.';
  }

  // 중복 / 존재 오류
  if (lower.includes('duplicate') || lower.includes('unique constraint') || lower.includes('이미') || lower.includes('already')) {
    return '이미 처리된 항목이에요. 목록을 새로고침해주세요.';
  }
  if (lower.includes('not_found') || lower.includes('not found') || lower.includes('찾을 수 없')) {
    return '해당 항목을 찾을 수 없어요. 목록을 새로고침해주세요.';
  }

  // 데이터 형식
  if (lower.includes('invalid') || lower.includes('malformed') || lower.includes('violates')) {
    return '입력값에 문제가 있어요. 다시 확인해주세요.';
  }

  // 서버 에러 (HTTP 5xx 감지)
  if (/http\s*5\d{2}/i.test(lower) || lower.includes('internal server') || lower.includes('bad gateway') || lower.includes('gateway timeout')) {
    return '서버에서 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
  }

  // 이미 한국어로 정제된 메시지(마리에 코드가 던진 것) 은 그대로 통과
  // — 단, HTTP N / raw code / SQL 이 섞였으면 fallback
  if (/http\s*\d{3}/i.test(msg) || /pgrst\d+/i.test(msg) || /supabase/i.test(msg)) {
    return fallback;
  }
  // 한글 비율이 60% 이상이면 이미 친절한 메시지로 간주
  const koCount = (msg.match(/[가-힣]/g) ?? []).length;
  if (koCount > msg.length * 0.3) return msg;

  return fallback;
}
