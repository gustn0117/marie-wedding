/**
 * 회원가입/로그인 등에서 사용하는 공용 검증 헬퍼.
 *
 * 이메일: HTML5 type=email은 'foo@barr.com'처럼 오타 도메인도 허용한다.
 * 도메인 마지막 라벨이 너무 짧거나(예: 단일 글자) 흔한 오타 패턴이면 차단.
 */

const COMMON_EMAIL_TYPOS = [
  /\.con$/i, /\.cmo$/i, /\.cm$/i, /\.comm$/i, /\.coom$/i, /\.copm$/i,
  /\.nett$/i, /\.nett$/i, /\.ent$/i, /\.nte$/i,
  /\.kr\.r$/i, /\.cm\.kr$/i, /\.cco\.kr$/i, /\.coo\.kr$/i, /\.co\.k$/i, /\.co\.r$/i,
  /naverr\.com$/i, /navr\.com$/i, /nver\.com$/i,
  /gmial\.com$/i, /gmial\.co\.kr$/i, /gmali\.com$/i, /gmaill\.com$/i, /gnail\.com$/i,
  /daumm\.net$/i, /daun\.net$/i,
  /hanmial\.net$/i, /hanmaill\.net$/i,
];

const VALID_TLDS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'me', 'app',
  'kr', 'jp', 'cn', 'us', 'uk', 'de', 'fr', 'au', 'ca', 'in', 'br', 'ru',
  'biz', 'info', 'name', 'pro', 'aero', 'asia', 'cat', 'coop', 'jobs',
  'mobi', 'museum', 'tel', 'travel', 'xyz', 'top', 'site', 'online', 'store',
  'tech', 'club', 'fun', 'live', 'shop', 'blog', 'design', 'studio', 'agency',
  'co.kr', 'or.kr', 'ne.kr', 'go.kr', 'ac.kr', 'pe.kr', 'hs.kr', 'ms.kr', 'es.kr',
  'sc.kr', 'kg.kr', 're.kr', 'mil.kr',
]);

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateEmail(raw: string): EmailValidationResult {
  const email = raw.trim();
  if (!email) return { valid: false, reason: '이메일을 입력해주세요.' };

  // 기본 형식
  const basic = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!basic.test(email)) return { valid: false, reason: '이메일 형식이 올바르지 않습니다.' };

  // 연속 . 또는 시작/끝 .
  if (/\.{2,}/.test(email)) return { valid: false, reason: '이메일에 연속된 마침표(..)가 있습니다.' };
  const [local, domain] = email.toLowerCase().split('@');
  if (local.startsWith('.') || local.endsWith('.')) return { valid: false, reason: '아이디 부분의 마침표 위치가 잘못되었습니다.' };
  if (domain.startsWith('.') || domain.startsWith('-') || domain.endsWith('-')) {
    return { valid: false, reason: '이메일 도메인이 올바르지 않습니다.' };
  }

  // 도메인 라벨 길이 (각 라벨 1~63자)
  const labels = domain.split('.');
  if (labels.some((l) => l.length === 0 || l.length > 63)) {
    return { valid: false, reason: '이메일 도메인이 올바르지 않습니다.' };
  }

  // TLD 검증 — 마지막 라벨 (또는 'co.kr' 같은 2단계 TLD)
  const lastTwo = labels.slice(-2).join('.');
  const last = labels[labels.length - 1];
  if (!VALID_TLDS.has(last) && !VALID_TLDS.has(lastTwo)) {
    return { valid: false, reason: `이메일 도메인의 최상위(.${last})가 올바르지 않은 것 같아요.` };
  }

  // 흔한 오타 패턴
  for (const pattern of COMMON_EMAIL_TYPOS) {
    if (pattern.test(domain)) {
      return { valid: false, reason: '이메일 도메인을 한 번 더 확인해 주세요. 오타일 가능성이 있어요.' };
    }
  }

  return { valid: true };
}

export interface PhoneValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * 한국 전화번호 형식 검증 (QA-015).
 *
 * 허용:
 *  - 02 (서울): 9자리(02-XXX-XXXX) 또는 10자리(02-XXXX-XXXX)
 *  - 0XX 일반 지역번호 / 010·011·016·017·018·019 휴대전화: 10~11자리
 *  - 050X 인터넷전화 / 070 / 080 / 0505 등도 10~11자리 패턴에 포함
 *
 * 차단 예시(QA-015): 031-555-555 (9자리, 02 아님) → 거절
 */
export function validatePhone(raw: string): PhoneValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: false, reason: '연락처를 입력해주세요.' };

  const digits = trimmed.replace(/[^0-9]/g, '');

  if (!digits.startsWith('0')) {
    return { valid: false, reason: '0으로 시작하는 전화번호를 입력해주세요. (예: 010-1234-5678)' };
  }

  const startsWithSeoul = digits.startsWith('02');
  const minLen = startsWithSeoul ? 9 : 10;
  const maxLen = startsWithSeoul ? 10 : 11;

  if (digits.length < minLen) {
    return {
      valid: false,
      reason: `자릿수가 짧습니다. ${startsWithSeoul ? '02-XXXX-XXXX' : '예) 010-1234-5678 / 031-555-5555'} 형식으로 입력해주세요.`,
    };
  }
  if (digits.length > maxLen) {
    return { valid: false, reason: '자릿수가 너무 많습니다. 다시 확인해주세요.' };
  }

  return { valid: true };
}

