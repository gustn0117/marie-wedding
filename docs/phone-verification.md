# 휴대폰 SMS OTP 인증 운영 가이드

마리에는 **자체 SMS OTP 방식** 휴대폰 인증을 제공합니다. (참고: 통신사 본인확인 PASS/NICE는 미사용 — 회당 ~200원 vs SMS OTP 회당 ~10원)

## 동작 요약

```
사용자가 번호 입력 → /api/phone-verification/request → 6자리 코드 생성·HMAC 해시 저장 → NHN Cloud SMS 발송
사용자가 코드 입력 → /api/phone-verification/verify → 해시 비교 → profile.phone_verified=true + phone_verified_at=NOW()
```

- 코드 TTL **5분**
- 시간당 발송 한도 **5회/회원**
- 코드는 평문 저장 X — HMAC-SHA256(`OTP_HASH_SALT`)
- `phone_otps` 테이블에 발송 이력 저장

## 운영 활성화 체크리스트

### 1. NHN Cloud 계정·발신번호 등록 (2~3일 소요)

1. https://www.toast.com 회원가입 (사업자번호 필요)
2. **콘솔 → SMS** 선택, 프로젝트 생성
3. **발신번호 사전등록** — 통신중계사업자 심사 (실제 사용 가능한 번호 1개)
   - 개인사업자: 통신가입증명원 + 신분증
   - 법인: 통신가입증명원 + 사업자등록증
4. 심사 통과 후 발신번호가 활성 → 발송 가능
5. **콘솔 → 앱 키 / 비밀 키** 확인

### 2. 서버 환경변수 설정

`.env.production` 또는 배포 인프라 변수에 추가:

```bash
SMS_PROVIDER=nhn
NHN_SMS_APP_KEY=<NHN Cloud SMS 앱 키>
NHN_SMS_SECRET_KEY=<NHN Cloud SMS 비밀 키>
NHN_SMS_SEND_NO=<사전등록 발신번호 (예: 01012345678)>
OTP_HASH_SALT=<openssl rand -hex 32 로 생성한 32바이트 hex>
```

> `OTP_HASH_SALT` 가 기본값(`marie-default-salt-change-me`)이면 운영 환경에서 500 응답.

### 3. 배포·재시작

```bash
ssh deploy "cd /home/server/apps/marie-wedding && docker compose down && PORT=3046 docker compose up -d --build"
```

### 4. 동작 검증

1. https://marie-wedding.hsweb.pics/mypage/phone-verification 접속
2. 본인 번호 입력 → "인증번호 받기"
3. 1분 이내 SMS 도착 확인
4. 6자리 입력 → "인증 완료"
5. /mypage 상단 nudge 배너가 사라졌는지 확인

## 비용

- **발송**: 단문 ~9.9원/건, 장문(80자 초과) ~33원/건. 마리에 메시지는 단문 한도 내.
- **NHN Cloud 월 정액 X**, 종량제만.
- 월 1,000명 인증 가정: 약 10,000원 (재발송 1.2회 고려)

## 코드 위치

| 위치 | 역할 |
|---|---|
| [src/app/api/phone-verification/request/route.ts](../src/app/api/phone-verification/request/route.ts) | OTP 발급 + SMS 발송 |
| [src/app/api/phone-verification/verify/route.ts](../src/app/api/phone-verification/verify/route.ts) | OTP 검증 + `phone_verified` 갱신 |
| [src/lib/sms/adapter.ts](../src/lib/sms/adapter.ts) | console / NHN 분기 |
| [src/features/notifications/lib/sms.ts](../src/features/notifications/lib/sms.ts) | NHN Cloud REST 호출 |
| [src/features/verification/components/PhoneVerificationForm.tsx](../src/features/verification/components/PhoneVerificationForm.tsx) | 사용자 UI (번호·코드 입력) |
| [src/features/verification/components/PhoneVerifyNudge.tsx](../src/features/verification/components/PhoneVerifyNudge.tsx) | 미인증 사용자 권유 배너 |
| [src/app/(main)/mypage/phone-verification/page.tsx](../src/app/(main)/mypage/phone-verification/page.tsx) | 인증 페이지 |

## 신뢰 등급(Trust Tier) 연동

`phone_verified=true` 가 되면 자동으로 `computeTrustTier()` 결과가 `phone_verified` 등급으로 승급 (`src/types/database.ts:72`). 카드·검색 결과에 인증 뱃지가 표시됩니다.

## 추후 확장(선택)

- **PASS / NICE 본인확인** 연동 — 실명·생년월일 일치까지 확인 필요할 때
  - 토스페이먼츠 본인인증 v2 가 가장 간단 (회당 ~280원)
  - 신뢰 등급 `business_verified` 자동 승급 트리거 추가 가능
- **카카오 본인인증** — 회당 ~100원, 카카오톡 발송
