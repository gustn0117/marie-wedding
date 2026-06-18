# 소셜 로그인 통합 (Kakao / Naver / Google / Apple) — 설계서

작성: 2026-06-19
대상: Marié (마리에) 웨딩 B2B 플랫폼

## 1. 목표와 비목표

### 목표
- Kakao, Naver, Google, Apple 4개 provider로 가입·로그인 지원
- 소셜 가입 후 짧은 온보딩(3필드) + just-in-time 추가 정보 수집의 하이브리드 흐름
- 이메일 가입자와 소셜 가입자의 공존, 동일 이메일 충돌 시 안전한 안내
- 마이페이지에서 능동적인 소셜 계정 연결/해제 (linkIdentity)

### 비목표
- 회원 일괄 데이터 마이그레이션 (기존 이메일 가입자는 그대로 유지)
- Apple App Store 배포 (Apple OAuth는 웹에서만; 추후 iOS 앱에서 재사용 가능한 형태로 설계)
- 카카오톡 채널 연동, 알림톡 발송 등 (별도 작업)

## 2. 핵심 결정 사항

### 2-1. Provider별 구현 방식
| Provider | 방식 | 콜백 |
|---|---|---|
| Kakao | Supabase native (`signInWithOAuth`) | `/auth/callback` |
| Google | Supabase native | `/auth/callback` |
| Apple | Supabase native | `/auth/callback` |
| Naver | **자체 OAuth 라우트** (Supabase 미지원) | `/auth/naver/callback` |

### 2-2. 네이버 user 식별 모델
- **Supabase `auth.identities`를 건드리지 않는다.** `profiles.naver_sub` 컬럼으로 자체 관리.
- 이유: `admin.createUser()`는 identity provider를 `'email'`로 박아넣어 이후 동일 이메일로 카카오 가입 시 충돌 검출 분기(`provider != 'naver'`)가 영구히 false로 평가됨.
- 네이버 user의 이메일은 1차 식별자가 아니라 보조. sub(id)가 PK 역할.

### 2-3. 가입 후 흐름 (D안 = 짧은 온보딩 + just-in-time)
1. OAuth 콜백에서 세션 발급 + profile row 생성 (`account_type=null`, `onboarded_at=null`)
2. 미들웨어가 `onboarded_at IS NULL` → `/onboarding`으로 강제 이동
3. `/onboarding` 폼 제출 → `onboarded_at=NOW()` set → `next` 경로로
4. 지역 다중 선택, 업종, 사업자번호, SMS 인증은 **just-in-time** (지원·공고 등록 등 트리거 시점)

### 2-4. 보안 모델
- 네이버 이메일은 `email_confirm: false`로 생성 → 자체 OTP/매직링크로 소유 증명 강제
- 네이버 OAuth state: `__Host-naver_oauth_state` cookie, HttpOnly + Secure + SameSite=Lax + 600s 만료 + 1회용
- linkIdentity 권한 가드 3종: 재인증 + 이메일 일치 + provider verified
- 모든 INSERT/UPDATE RLS 정책에 `onboarded_at IS NOT NULL` 가드 (미들웨어 + RLS + 서버 가드 3중 방어)
- 동일 이메일 충돌 시 generic 메시지(`이미 등록된 이메일입니다`)로 enumeration 방지

## 3. DB 마이그레이션

### `marie_wedding.profiles` 컬럼 추가
```sql
ALTER TABLE marie_wedding.profiles
  ALTER COLUMN account_type DROP NOT NULL,
  ALTER COLUMN region DROP NOT NULL,
  ADD COLUMN signup_provider TEXT,
  ADD COLUMN onboarded_at TIMESTAMPTZ,
  ADD COLUMN naver_sub TEXT UNIQUE;

CREATE INDEX idx_profiles_naver_sub ON marie_wedding.profiles(naver_sub) WHERE naver_sub IS NOT NULL;
CREATE INDEX idx_profiles_onboarded_at ON marie_wedding.profiles(onboarded_at);

-- 기존 row backfill: 이미 account_type/region이 채워진 row는 onboarded_at = created_at으로 시드
UPDATE marie_wedding.profiles
SET onboarded_at = COALESCE(updated_at, created_at, NOW())
WHERE account_type IS NOT NULL AND onboarded_at IS NULL;
```

### RLS 정책 강화
- `jobs`, `posts`, `applications`, `comments` 등 모든 INSERT/UPDATE 정책에 다음 조건 AND:
  ```sql
  EXISTS (
    SELECT 1 FROM marie_wedding.profiles
    WHERE user_id = auth.uid() AND onboarded_at IS NOT NULL
  )
  ```

### TypeScript 타입 변경 (`src/types/database.ts`)
```typescript
export interface Profile {
  // ...기존 필드...
  account_type: AccountType | null;           // ← non-null → nullable
  region: Region | null;                       // ← non-null → nullable
  signup_provider?: 'email' | 'kakao' | 'google' | 'apple' | 'naver' | null;
  onboarded_at?: string | null;
  naver_sub?: string | null;
}
```

## 4. 신규 라우트와 컴포넌트

### 라우트 (Next.js App Router)
| 경로 | 종류 | 책임 |
|---|---|---|
| `/onboarding` | page | 3필드 폼 (계정유형 / 이름·회사명 / 휴대폰) |
| `/onboarding/email-required` | page | 네이버 이메일 미제공 시 직접 입력 + OTP |
| `/auth/processing` | page | 네이버 콜백 처리 중 로딩 화면 |
| `/auth/naver/start` | route handler | state 발급 + nid.naver.com redirect |
| `/auth/naver/callback` | route handler | code 교환 + profile upsert + 세션 발행 |

### 컴포넌트
- `src/features/auth/components/SocialLoginButtons.tsx` — 4 provider 버튼 row
- `src/features/onboarding/components/OnboardingForm.tsx` — 3필드 폼
- `src/features/mypage/components/ConnectedAccountsSection.tsx` — 연결/해제 토글

### 라이브러리
- `src/lib/naver-oauth.ts`
  - `buildAuthorizationUrl(state: string): string`
  - `signState(): { state: string; cookie: string }`
  - `verifyState(queryState: string, cookieState: string): boolean` (상수시간 비교)
  - `exchangeCodeForToken(code: string, state: string): Promise<{ access_token, refresh_token, expires_in }>`
  - `fetchUserInfo(accessToken: string): Promise<{ id: string; email?: string; name?: string; mobile?: string }>`
  - Runtime: `'nodejs'` 명시 (Edge에서 작동 안 함)

## 5. 흐름 상세

### 5-1. 신규 카카오/구글/Apple 가입
```
사용자: /login에서 [카카오] 버튼 클릭
  ↓
client: supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: '/auth/callback' } })
  ↓ (Supabase가 OAuth 처리)
브라우저: /auth/callback?code=...&next=/jobs
  ↓
server: exchangeCodeForSession(code) → 세션 쿠키 자동 발행
  ↓
server: profile select where user_id = session.user.id
  ↓
  └─ 없음: INSERT {
       contact_name: provider name fallback,
       account_type: null,
       region: null,
       signup_provider: user.app_metadata.provider,   // 'kakao'|'google'|'apple'
       onboarded_at: null,
     }
     → redirect /onboarding?next=/jobs
  └─ 있음 + onboarded_at IS NULL: redirect /onboarding?next=/jobs
  └─ 있음 + onboarded_at NOT NULL: redirect next (/jobs)
```

### 5-2. 신규 네이버 가입
```
사용자: /login에서 [네이버] 버튼 클릭
  ↓ (브라우저 이동)
/auth/naver/start
  ↓ ① crypto.randomBytes(32) → rawState
  ↓ ② HMAC(rawState, NAVER_OAUTH_STATE_SECRET) → signedState
  ↓ ③ Set-Cookie: __Host-naver_oauth_state=rawState; HttpOnly; Secure; SameSite=Lax; Path=/auth/naver; Max-Age=600
  ↓ ④ redirect nid.naver.com/oauth2.0/authorize?response_type=code&client_id=...&state=signedState&redirect_uri=...
  ↓ (네이버에서 동의)
/auth/naver/callback?code=...&state=signedState
  ↓ ① cookie의 rawState 읽기 → HMAC 재계산 → query state와 상수시간 비교 → 통과 시 cookie 삭제
  ↓ ② code → POST https://nid.naver.com/oauth2.0/token → access_token
  ↓ ③ GET https://openapi.naver.com/v1/nid/me with Bearer access_token → { id, email?, name?, mobile? }
  ↓ ④ profile select where naver_sub = response.id
  ↓
  └─ 있음: 기존 session_user.id로 verifyOtp 흐름 (아래 ⑤)
  └─ 없음:
      └─ email 있음:
          └─ profile select where email = response.email AND signup_provider != 'naver'
              └─ 있음 (충돌): redirect /login?conflict=1 (generic)
              └─ 없음:
                  ↓ admin.createUser({ email: response.email, email_confirm: false })  // 미검증
                  ↓ profiles INSERT { user_id, naver_sub, signup_provider:'naver', contact_name: response.name, onboarded_at: null }
                  ↓ ⑤ 세션 발행
      └─ email 없음:
          ↓ admin.createUser({ email: `naver_${response.id}@social.marie.local`, email_confirm: false })
          ↓ profiles INSERT { user_id, naver_sub, signup_provider:'naver', onboarded_at: null }
          ↓ ⑤ 세션 발행 → redirect /onboarding/email-required?next=/jobs
  ↓ ⑤ 세션 발행:
       admin.generateLink({ type: 'magiclink', email: <user.email> }) → { properties.hashed_token }
       createServerClient(cookies()) (anon key, @supabase/ssr) → verifyOtp({ token_hash, type: 'magiclink' })
       ↓ SDK가 Set-Cookie 자동 발행
  ↓ redirect /onboarding?next=/jobs  (또는 onboarded_at NOT NULL이면 next)
```

### 5-3. 동일 이메일 충돌 (이메일 가입 user가 같은 이메일로 카카오 시도)
```
Supabase가 자체 충돌 처리 (identity 충돌 에러)
  ↓ /auth/callback에서 exchangeCodeForSession 에러 캐치
  ↓ redirect /login?error=conflict (generic)
  ↓ /login: "이미 등록된 이메일입니다. 로그인 페이지에서 시도해 주세요"
            [내가 어떻게 가입했는지 모르겠어요]   ← 본인 확인 흐름 (별도 기능, v2)
```

v1에서는 generic 메시지만, 본인 확인 후 mask된 provider 노출 + linkIdentity 자동 흐름은 v2.

### 5-4. 온보딩 폼 제출
```
폼 입력: account_type ('individual'|'business'), name, phone
  ↓ POST /api/onboarding (서버 액션 또는 API 라우트)
  ↓ server: session 확인
  ↓ server: UPDATE profiles SET
              account_type = $1,
              contact_name = $2,   -- 개인: 이름 그대로 / 업체: 사용자 입력
              company_name = $3,   -- 업체일 때만
              phone = $4,
              onboarded_at = NOW()
            WHERE user_id = session.user.id
  ↓ redirect next or /jobs
```

### 5-5. 마이페이지 연결된 계정
- `/mypage/edit` 페이지에 `ConnectedAccountsSection` 추가
- 현재 user의 `auth.identities`를 조회해 각 provider별 연결 상태 표시
- 연결: `supabase.auth.linkIdentity({ provider })` 호출 전 가드 3종 검사
- 해제: `supabase.auth.unlinkIdentity({ identity_id })` 호출 전 "마지막 인증 수단 보호" 검사

## 6. 미들웨어 변경

### 가드 순서 (위에서 아래로)
1. Banned 사용자 → `/banned` (기존)
2. **명시적 public path bypass** (whitelisted):
   - `/`, `/login`, `/signup`
   - `/auth/*` (전체)
   - `/api/auth/*` (전체)
   - `/onboarding`, `/onboarding/email-required`
   - `/banned`, `/admin/*`
   - 정적 자산 (Next.js 기본 + `/_next/*`, `/favicon.ico`)
3. 비로그인 → `/login`
4. **Onboarding 가드**: 로그인 + profile 존재 + `onboarded_at IS NULL` + non-public path → `/onboarding?next=<현재경로>`
5. Admin role 가드 (기존)

### `profile` select 컬럼 추가
- `onboarded_at`, `account_type` 컬럼을 select에 포함

## 7. 환경변수와 외부 설정

### `.env.local` 추가
```
# 네이버 OAuth (자체 구현)
NAVER_CLIENT_ID=<네이버 Developers에서 발급>
NAVER_CLIENT_SECRET=<서버 only, 절대 NEXT_PUBLIC_ 금지>
NAVER_OAUTH_STATE_SECRET=<HMAC 키, 32바이트 random hex>
```

### Supabase 콘솔
- Authentication > Providers
  - Kakao: REST API Key + Redirect URL `${NEXT_PUBLIC_APP_URL}/auth/callback`
  - Google: Client ID + Secret (Google Cloud Console 발급) + 동일 redirect
  - Apple: Service ID + Team ID + Key ID + .p8 키 + 동일 redirect

### 네이버 Developers (developers.naver.com)
- 애플리케이션 등록 → 사용 API: "네아로(네이버 아이디로 로그인)"
- 서비스 URL: `${NEXT_PUBLIC_APP_URL}`
- Callback URL: `${NEXT_PUBLIC_APP_URL}/auth/naver/callback`
- 동의 항목: 이메일(필수), 이름, 휴대전화번호 (옵션)

### Apple Developer
- App ID 생성 (Sign In with Apple capability)
- Services ID 생성 → return URL `${NEXT_PUBLIC_APP_URL}/auth/callback`
- Key 생성 (.p8 다운로드)

## 8. UI 명세

### `/login`, `/signup`
- 페이지 상단에 `SocialLoginButtons` 컴포넌트
- 레이아웃:
  ```
  ┌──────────────────────┐
  │ [카카오로 시작하기]    │  bg:#FEE500 text:#000
  │ [네이버로 시작하기]    │  bg:#03C75A text:#fff
  │ [Google로 시작하기]    │  bg:#fff text:#000 border
  │ [Apple로 시작하기]     │  bg:#000 text:#fff
  ├──── 또는 ────────────┤
  │ 이메일 폼…             │
  └──────────────────────┘
  ```

### `/onboarding`
- 헤더: "환영합니다, {name}님! 맞춤 공고를 보여드릴게요"
- 진행률 표시: "1단계 / 약 30초"
- 계정 유형 카드 2개 (역할 중심 라벨):
  - **일자리를 찾고 있어요** — 플래너 / 도우미 / 프리랜서
  - **직원을 채용하거나 업체를 홍보해요** — 예식장 / 드레스 / 스튜디오 / 메이크업
- 입력 필드 (계정 유형 선택 후 노출):
  - 이름 또는 회사명 (라벨이 계정 유형에 따라 달라짐)
  - 휴대폰 (010-XXXX-XXXX 형식 검증만)
- "나중에 마이페이지에서 변경 가능" 보조 문구
- 완료 버튼 → 제출 시 로딩 → 리다이렉트

### `/auth/processing`
- 네이버 콜백 처리 중에만 보임
- 스피너 + "네이버 로그인 처리 중입니다…"
- 5초 초과 시 "조금만 더 기다려주세요" 카피 변경
- 10초 초과 시 "다시 시도하기" 버튼 노출

### `/mypage/edit > ConnectedAccountsSection`
- 섹션 헤더: "연결된 계정"
- 설명: "소셜 계정을 연결하면 다음부터 더 빠르게 로그인할 수 있어요. 기존 이메일 로그인도 그대로 유지됩니다."
- 4개 provider 행 + (이메일 로그인이 있는 경우) 이메일 행
- 각 행: 아이콘 + 이름 + 상태 + 액션 버튼

## 9. 파일 변경 인벤토리

### 신규
- `supabase/migrations/20260619_social_login.sql`
- `src/lib/naver-oauth.ts`
- `src/app/auth/naver/start/route.ts`
- `src/app/auth/naver/callback/route.ts`
- `src/app/auth/processing/page.tsx`
- `src/app/onboarding/layout.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/onboarding/email-required/page.tsx`
- `src/app/api/onboarding/route.ts`
- `src/features/auth/components/SocialLoginButtons.tsx`
- `src/features/onboarding/components/OnboardingForm.tsx`
- `src/features/mypage/components/ConnectedAccountsSection.tsx`
- `docs/auth-social-login.md`

### 수정
- `src/app/auth/callback/route.ts` — account_type='individual' 강제 박는 코드 제거, signup_provider/onboarded_at NULL로 INSERT, /onboarding으로 redirect
- `src/lib/supabase/middleware.ts` — public path 화이트리스트 명시, onboarding 가드 추가
- `src/features/auth/services/auth-service.ts` — signInWithGoogle/Apple/Naver 함수 추가
- `src/app/(auth)/login/page.tsx` — SocialLoginButtons 삽입
- `src/app/(auth)/signup/page.tsx` — SocialLoginButtons 삽입
- `src/app/(main)/mypage/edit/page.tsx` — ConnectedAccountsSection 삽입
- `src/types/database.ts` — account_type/region nullable, 신규 3컬럼 추가
- `README.md` — 환경변수 섹션에 NAVER_* 추가
- `CLAUDE.md` — Architecture > Supabase Configuration 섹션에 social login 한 줄 링크

## 10. 보안 체크리스트

- [ ] `NAVER_CLIENT_SECRET`, `NAVER_OAUTH_STATE_SECRET`은 `NEXT_PUBLIC_` 접두사 금지
- [ ] `/auth/naver/*` route handler에 `export const runtime = 'nodejs'`
- [ ] state cookie: `__Host-` prefix + HttpOnly + Secure + SameSite=Lax + path 한정 + maxAge 600
- [ ] state 비교: 상수시간 (`crypto.timingSafeEqual`)
- [ ] state 검증 통과 즉시 cookie 삭제 (1회용)
- [ ] 네이버 이메일은 `email_confirm: false`로 생성
- [ ] linkIdentity 가드 3종 (재인증 + 이메일 일치 + verified)
- [ ] returnTo 파라미터 동일 origin + 허용 path 화이트리스트 검증
- [ ] `Referrer-Policy: no-referrer` 콜백 페이지 메타
- [ ] RLS: `onboarded_at IS NOT NULL` 가드를 jobs/posts/applications/comments에 추가
- [ ] 콜백 에러 응답에 client_secret 마스킹
- [ ] 동일 이메일 충돌 메시지 generic 화 (provider 명시 X)

## 11. 검증 / 테스트 시나리오

수동 검증 항목:
1. 신규 user 4 provider 각각 가입 → onboarding → /jobs 진입
2. 이메일 가입 user가 같은 이메일로 카카오 시도 → generic 차단 화면
3. 네이버 email 동의 거부 → `/onboarding/email-required` 진입
4. 미들웨어 무한 루프 회피: `/onboarding` 자체에서 또 redirect 안 됨 확인
5. onboarded_at IS NULL user가 PostgREST 직접 POST → RLS 거부 확인
6. 마이페이지에서 카카오 연결 → 다음 로그인 카카오로 정상
7. 마지막 인증 수단 해제 시도 → 경고 모달 노출

## 12. 단계별 배포 순서

1. **DB 마이그레이션** 적용 (Supabase 콘솔 SQL Editor 또는 CLI)
2. **환경변수** 추가 (`.env.local` + 운영 환경)
3. **외부 콘솔 설정**: Supabase Providers, 네이버 Developers, Apple Developer
4. **코드 배포** (모든 변경 동시)
5. **smoke test**: provider별 신규 가입 1회씩

## 13. 비교적 위험한 부분

- 네이버 자체 OAuth: 한 번도 운영 안 한 경로. 첫 번째 사용자가 막힐 가능성 ↑ → `/auth/processing` 로딩 화면과 에러 분기 풍부하게.
- DB 마이그레이션의 `account_type DROP NOT NULL`: 기존 데이터에 영향 없으나 backfill 안 하면 미들웨어가 모든 기존 user를 `/onboarding`으로 보냄 → 반드시 backfill UPDATE 같이 실행.
- linkIdentity unlink가 마지막 인증 수단을 해제하면 계정 잠금 → 가드 필수.

## 14. v2로 미루는 항목

- 동일 이메일 충돌 시 본인 확인 후 mask된 provider 노출 + linkIdentity 자동 흐름
- SMS 인증 just-in-time 모달
- 사업자번호 검증 just-in-time 모달
- 카카오 알림톡 연동
- iOS 앱에서 Apple Sign In 재사용

---

승인 받음. 자동 진행으로 spec → 구현 → 빌드 → push 까지 진행.
