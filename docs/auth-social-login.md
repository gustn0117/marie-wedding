# 소셜 로그인 설정 가이드

Marié는 4개 provider 소셜 로그인을 지원합니다.

| Provider | 방식 | 설정 위치 |
|---|---|---|
| Kakao | Supabase native | Supabase 콘솔 |
| Google | Supabase native | Supabase 콘솔 + Google Cloud Console |
| Apple | Supabase native | Supabase 콘솔 + Apple Developer |
| Naver | 자체 OAuth 라우트 | 네이버 Developers + `.env.local` |

## 환경변수

`.env.local`에 추가:

```
NAVER_CLIENT_ID=<네이버 Developers에서 발급>
NAVER_CLIENT_SECRET=<서버 only — 절대 NEXT_PUBLIC_ 금지>
NAVER_OAUTH_STATE_SECRET=<32바이트 random hex (HMAC 키)>
```

`NAVER_OAUTH_STATE_SECRET`은 새로 생성:
```bash
openssl rand -hex 32
```

Kakao/Google/Apple은 코드/.env에 client_id/secret 둘 필요 없음. Supabase 콘솔에만 입력.

## Supabase 콘솔 설정

대시보드 > Authentication > Providers:

### Kakao
1. https://developers.kakao.com 에서 앱 등록
2. 카카오 로그인 활성화 → REST API 키 복사
3. Supabase: Kakao 활성화 → REST API 키 입력
4. Redirect URL을 카카오 콘솔에 등록: `<NEXT_PUBLIC_APP_URL>/auth/callback`

### Google
1. https://console.cloud.google.com 에서 OAuth client 생성
2. 승인된 리디렉션 URI에 `<NEXT_PUBLIC_APP_URL>/auth/callback` 추가
3. Supabase: Google 활성화 → Client ID / Secret 입력

### Apple
1. https://developer.apple.com 에서 App ID 생성 (Sign In with Apple capability)
2. Services ID 생성 → return URL `<NEXT_PUBLIC_APP_URL>/auth/callback`
3. Key 생성 → .p8 다운로드
4. Supabase: Apple 활성화 → Service ID / Team ID / Key ID / .p8 키 내용 입력

### 공통 Redirect URL
Supabase 자체 콜백 URL은 `https://<프로젝트>.supabase.co/auth/v1/callback`이며,
provider 콘솔에 등록할 redirect URL은 위와 같이 `<NEXT_PUBLIC_APP_URL>/auth/callback`입니다.
Supabase가 중간에서 처리한 뒤 우리 앱의 `/auth/callback`으로 redirect합니다.

## 네이버 Developers 설정

1. https://developers.naver.com/main 접속
2. Application 등록 → 사용 API: **네아로(네이버 아이디로 로그인)**
3. 서비스 URL: `<NEXT_PUBLIC_APP_URL>`
4. Callback URL: `<NEXT_PUBLIC_APP_URL>/auth/naver/callback`
5. 동의 항목:
   - 이메일 (필수 권장 — 미동의 시 사용자가 별도 입력 필요)
   - 이름
   - 휴대전화번호 (옵션)
6. Client ID와 Client Secret을 `.env.local`에 입력

## DB 마이그레이션

다음 SQL을 실행 (Supabase 콘솔 SQL Editor 또는 CLI):

```bash
psql "$DATABASE_URL" < supabase/migrations/2026-06-19-social-login.sql
```

변경 내용:
- `profiles.account_type`, `region` NULL 허용 (가입 직후 미선택 상태)
- `profiles.signup_provider` 컬럼 추가 (`'email'|'kakao'|'google'|'apple'|'naver'`)
- `profiles.onboarded_at` 컬럼 추가 (온보딩 완료 시각)
- `profiles.naver_sub` 컬럼 추가 (네이버 자체 식별)
- 기존 사용자 backfill: `account_type`이 채워진 row는 `onboarded_at = created_at`로 시드
- RLS: `jobs`, `posts`, `applications`, `comments` INSERT에 `is_onboarded()` 가드 추가

## 흐름 요약

### 신규 가입 (Kakao/Google/Apple)
1. 사용자 `/login`에서 provider 버튼 클릭
2. Supabase가 OAuth 처리 → `/auth/callback?code=...`
3. 콜백이 세션 발급 + `profiles` INSERT (`account_type=null, onboarded_at=null`)
4. `/onboarding`으로 redirect (계정 유형 / 이름 / 휴대폰 3필드)
5. 폼 제출 → `onboarded_at = NOW()` → `/jobs`

### 신규 가입 (Naver)
1. 사용자 `/login`에서 네이버 버튼 클릭
2. `/auth/naver/start`가 state cookie 발급 + nid.naver.com으로 redirect
3. `/auth/naver/callback`이 state 검증 + code 교환 + 사용자 정보 조회
4. `profiles` INSERT + Supabase 세션 발행
5. 이메일이 있으면 `/onboarding`, 없으면 `/onboarding/email-required`로

### 동일 이메일 충돌
- 이메일 가입자가 같은 이메일로 다른 provider 로그인 시도 → `/login?error=conflict`
- 메시지: "이미 등록된 이메일입니다. 로그인 페이지에서 시도해주세요." (provider 비노출 — enumeration 방지)

### 마이페이지 계정 연결
- `/mypage/edit` 페이지 하단 "연결된 계정" 섹션
- `supabase.auth.linkIdentity()` 호출
- 마지막 인증 수단 해제 시도 시 차단

## 보안 체크리스트 (운영 전 확인)

- [ ] `NAVER_CLIENT_SECRET`이 `NEXT_PUBLIC_` 접두사로 시작하지 않는다
- [ ] `NAVER_OAUTH_STATE_SECRET`이 32바이트 이상 랜덤 값이다
- [ ] DB 마이그레이션이 적용되었고 기존 사용자 `onboarded_at` backfill이 완료되었다
- [ ] 4개 provider 모두 신규 가입 → 온보딩 → 진입 흐름이 작동한다
- [ ] 동일 이메일로 다른 provider 시도 시 generic 에러 메시지가 노출된다
- [ ] `/mypage/edit`에서 마지막 인증 수단 해제 시 차단된다

## 트러블슈팅

### `naver_state_mismatch`
- cookie가 발급 후 redirect 전에 만료/삭제됨
- 가능 원인: `NEXT_PUBLIC_APP_URL`이 https가 아님 (Secure cookie는 https에서만 발급)
- 개발 환경: localhost는 Safari에서 Secure cookie를 받지 않음. Chrome 또는 https 터널 사용 권장

### `naver_token_failed`
- Client ID / Secret 불일치 또는 Callback URL 미등록
- 네이버 Developers에서 Callback URL을 정확히 확인 (`/auth/naver/callback`)

### `naver_session_failed`
- Supabase admin API 권한 문제. `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있는지 확인

### OAuth 신규 가입 후 `/jobs`에서 무한 redirect
- `profiles.onboarded_at`이 채워지지 않은 상태에서 미들웨어가 계속 `/onboarding`으로 보냄
- `/api/onboarding`이 정상 작동하는지 확인 (서버 로그 확인)

## v2 로드맵

- 동일 이메일 충돌 시 본인 확인 후 mask된 provider 노출 + 자동 linkIdentity
- 네이버 이메일 미제공 시 OTP 인증 후 이메일 등록
- linkIdentity 가드 강화 (step-up 재인증)
- SMS 휴대폰 인증 just-in-time 모달
