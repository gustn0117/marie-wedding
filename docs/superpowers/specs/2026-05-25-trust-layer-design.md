# 신뢰 레이어 (Trust Layer) 설계

> Marié (마리에) B2B 웨딩 네트워킹 플랫폼의 핵심 차별점인 "신뢰 레이어"를 구현하기 위한 설계 문서.
> 작성일: 2026-05-25

---

## 1. 배경 및 목표

마리에의 장기 비전은 단순 구인구직 게시판을 넘어 **"프로필·포트폴리오·평판이 축적되는 산업 신뢰 레이어"**가 되는 것이다. 사업계획서에 명시된 이 비전을 위해 현재 빈 영역인 (1) 업체 인증, (2) 거래 후 리뷰, (3) 포트폴리오 구조화를 풀스택으로 구축한다.

본 작업은 다음 3개의 신규 도메인을 도입한다.

1. **Verification** — 사업자등록증 기반 업체 인증 / 휴대폰 본인인증 기반 개인 실명 확인
2. **Reviews** — 거래 완료 후 양방향 태그 기반 리뷰
3. **Portfolios** — 작품 단위 포트폴리오 (기존 `profiles.gallery TEXT[]` 대체)

부수적으로 `profiles`·`applications` 테이블이 보강되며, 신뢰 점수(거래 완료 수·응답률·평균 응답 시간)가 자동 계산된다.

---

## 2. 핵심 결정 요약

| 항목 | 결정 |
|---|---|
| 인증 방식 (업체) | 사업자등록증 이미지 업로드 + 사업자번호 입력 → 관리자 수동 승인 |
| 인증 방식 (개인) | 휴대폰 SMS OTP 본인인증 (`phone_verified` 플래그) |
| 리뷰 방식 | 사전 정의 태그 기반 (자유 텍스트 없음, 최대 5개 선택) |
| 리뷰 활성화 조건 | `applications.status='accepted'` + 양쪽 모두 "거래 완료" 체크 |
| 리뷰 작성 기한 | 양쪽 거래 완료 후 30일 이내 |
| 리뷰 수정 정책 | 작성 후 수정 불가. 잘못 작성한 경우 신고로만 처리. (1인 운영 부담 최소화) |
| 리뷰 익명성 | 실명 공개 (B2B 책임성 우선) |
| 신뢰 점수 계산 | DB 트리거 / 함수로 자동 계산 |
| 카드 노출 | 인증 배지 + "거래 N건 · 응답률 N%" 메타 한 줄 |
| 디자인 톤 | 기존 무채색 팔레트 유지, 새 색 추가 금지 |
| 작업 범위 | 신뢰 레이어 풀스택만. DM·캘린더·태그 시스템은 본 작업 제외 |

---

## 3. 데이터 모델

### 3-1. `profiles` 테이블 보강

기존 `profiles`에 다음 컬럼 추가:

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `verification_status` | ENUM(`unverified`,`pending`,`verified`,`rejected`) DEFAULT `unverified` | 인증 상태 |
| `verification_document` | TEXT NULL | Storage 경로 (사업자등록증 이미지) |
| `verification_submitted_at` | TIMESTAMPTZ NULL | 인증 신청 시각 |
| `verification_reviewed_at` | TIMESTAMPTZ NULL | 관리자 처리 시각 |
| `verification_reject_reason` | TEXT NULL | 거절 사유 (사용자에게 노출) |
| `business_number` | TEXT NULL | 사업자번호 (business 계정만) |
| `verified_at` | TIMESTAMPTZ NULL | 최종 승인 시각 |
| `phone_verified` | BOOLEAN DEFAULT FALSE | 휴대폰 본인인증 완료 여부 |
| `phone_verified_at` | TIMESTAMPTZ NULL | 휴대폰 본인인증 완료 시각 |
| `response_rate` | NUMERIC(5,2) DEFAULT 0 | 본인 공고 지원 중 응답한 비율 (0~100) |
| `avg_response_minutes` | INTEGER NULL | 첫 응답까지 평균 분 |
| `completed_deals_count` | INTEGER DEFAULT 0 | 양쪽 모두 "거래 완료" 처리한 application 수 |

> **`gallery TEXT[]` 처리**: 기존 컬럼은 마이그레이션 후 `portfolios` 테이블로 데이터 이관. 컬럼 자체는 backwards-compat 위해 한 phase 유지 후 다음 phase에서 삭제.

### 3-2. `portfolios` 신규 테이블

```sql
CREATE TABLE marie_wedding.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,                 -- 작품 제목 ("OO호텔 8월 본식")
  event_date DATE,                     -- 진행 일자
  role TEXT,                           -- 본인 역할 (사회자/축가/메이크업 등)
  venue_name TEXT,                     -- 예식장 이름 (선택)
  description TEXT,
  images TEXT[] DEFAULT '{}' NOT NULL, -- Storage 경로 배열
  cover_image TEXT,                    -- 대표 이미지 경로
  is_featured BOOLEAN DEFAULT FALSE NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_portfolios_profile_order
  ON marie_wedding.portfolios(profile_id, display_order)
  WHERE deleted_at IS NULL;
```

### 3-3. `review_tags` 신규 테이블 (관리자 마스터)

```sql
CREATE TYPE marie_wedding.review_tag_category AS ENUM ('positive', 'attention');

CREATE TABLE marie_wedding.review_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,                    -- "시간 약속 잘 지킴"
  category marie_wedding.review_tag_category NOT NULL,
  applies_to TEXT[] NOT NULL,                    -- 'hiring' | 'applicant' | both
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**초기 시드 데이터:**

| label | category | applies_to |
|---|---|---|
| 시간 약속을 잘 지킴 | positive | both |
| 소통이 원활함 | positive | both |
| 사전 협의와 실제가 일치함 | positive | both |
| 현장 대응력이 좋음 | positive | both |
| 결제·정산이 깔끔함 | positive | hiring |
| 포트폴리오와 실물이 일치함 | positive | applicant |
| 응답이 늦음 | attention | both |
| 사전 협의와 실제가 불일치함 | attention | both |
| 일방적 변경·취소 | attention | both |

### 3-4. `reviews` 신규 테이블

```sql
CREATE TYPE marie_wedding.review_direction AS ENUM ('hiring_to_applicant', 'applicant_to_hiring');

CREATE TABLE marie_wedding.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES marie_wedding.applications(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  direction marie_wedding.review_direction NOT NULL,
  tags UUID[] NOT NULL,                          -- review_tags.id 배열, 최대 5개
  is_public BOOLEAN DEFAULT TRUE NOT NULL,
  is_hidden_by_admin BOOLEAN DEFAULT FALSE NOT NULL, -- 신고 처리 시 비공개
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_reviews_application_direction
  ON marie_wedding.reviews(application_id, direction)
  WHERE deleted_at IS NULL;
```

### 3-5. `applications` 테이블 보강

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `hiring_completed_at` | TIMESTAMPTZ NULL | 공고 작성자가 "거래 완료" 체크한 시각 |
| `applicant_completed_at` | TIMESTAMPTZ NULL | 지원자가 "거래 완료" 체크한 시각 |
| `first_responded_at` | TIMESTAMPTZ NULL | status가 처음 pending 외로 변경된 시각 (응답률 계산용) |

### 3-6. Storage 버킷

새 버킷 `verifications/` 추가. 구조: `verifications/{profile_id}/{uuid}.{ext}`.

**RLS**: 본인 + 관리자만 read. anon 접근 불가.

`portfolios/` 버킷 신규 추가. 구조: `portfolios/{profile_id}/{portfolio_id}/{uuid}.{ext}`. public read.

### 3-7. RLS 정책

- `portfolios`
  - SELECT: deleted_at IS NULL OR is_admin()
  - INSERT/UPDATE/DELETE: profile_id가 본인 OR admin
- `reviews`
  - SELECT: is_public=true AND is_hidden_by_admin=false AND deleted_at IS NULL — 누구나 / 자신이 작성한 것 / 자신이 대상인 것 / admin
  - INSERT: reviewer_id가 본인 + 거래 완료 조건 충족 검증 (DB 함수에서 처리)
  - UPDATE: 없음 (작성 후 수정 불가)
  - DELETE: admin (신고 처리)
- `review_tags`
  - SELECT: 누구나 (is_active=true만)
  - INSERT/UPDATE/DELETE: admin만

### 3-8. DB 함수 (자동 계산)

**`recalc_response_metrics(p_profile_id UUID)`** — 본인이 작성한 jobs의 applications를 기준으로 `response_rate`, `avg_response_minutes` 갱신.

**`increment_completed_deals(p_profile_id UUID)`** — `completed_deals_count` +1.

**`submit_review(...)` RPC** — 거래 완료 양방향 체크 + 작성 기한 + UNIQUE 위반 등 검증을 한 함수에서 atomic하게 처리. 직접 INSERT는 RLS에서 막고 RPC만 허용.

**트리거**:
- `applications.status` 변경 시 `first_responded_at` 자동 설정
- `applications` 양쪽 `*_completed_at` 모두 채워지면 양 profile의 `completed_deals_count` +1 + 알림 발송
- `verification_status` → `verified` 전환 시 `verified_at` 자동 기록 + 알림

---

## 4. 사용자 흐름

### 4-1. 인증 흐름 (업체)

1. `/mypage` → "인증 신청" 카드 (verification_status에 따라 상태별 표시)
2. `/mypage/verification` → 사업자번호 입력 + 사업자등록증 이미지 업로드 폼
3. 제출 시 `verification_status='pending'`, `verification_submitted_at=NOW()`
4. 관리자가 `/admin/verifications`에서 이미지+번호 확인 후 승인/거절
5. 승인: `verification_status='verified'`, `verified_at=NOW()`, 사용자에게 알림
6. 거절: `verification_status='rejected'` + `verification_reject_reason` 설정, 사용자가 보고 재신청 가능

### 4-2. 인증 흐름 (개인) — **Phase 5에서 구현**

1. `/mypage` → "본인인증" 카드
2. 휴대폰 번호 입력 → SMS OTP 발송 → 입력 확인
3. 성공 시 `phone_verified=true`, `phone_verified_at=NOW()`
4. **SMS 서비스 선정**: NHN Cloud Notification 또는 NCP SENS 중 결제·계약 부담 적은 쪽. Phase 5 시작 시점에 다시 결정.

> Phase 1~4에서는 `phone_verified` 컬럼만 사전 추가하고 UI는 노출하지 않는다. `phone_verified=false`인 개인 계정은 카드에 "실명 확인" 배지가 표시되지 않는 것이 기본 동작이므로 시각적 차이는 없다.

### 4-3. 거래 완료 흐름

1. `applications.status='accepted'` 이후 양쪽 인터페이스에 "거래 완료 표시" 버튼 노출
2. 한쪽 클릭 시 본인 측 `*_completed_at` 기록, 상대방에게 알림
3. 양쪽 모두 채워지면 트리거가 `completed_deals_count` 양쪽 +1 + "리뷰 작성 가능" 알림 발송
4. 한쪽이 30일 내 미응답 시 자동 만료 (자동 만료 cron은 본 spec 제외, 추후)

### 4-4. 리뷰 작성 흐름

1. `/applications/{id}/review` (또는 마이페이지 "리뷰 작성" 큐에서 진입)
2. 사전 정의 태그 중 1~5개 선택 (positive·attention 혼합 허용)
3. 제출 시 `submit_review()` RPC 호출, 검증 후 INSERT
4. 작성 완료 후 reviewee에게 알림

### 4-5. 신고 흐름

기존 `reports` 테이블의 `target_type`에 `review` 추가. 관리자가 `/admin/reports`에서 처리. 처리 결과로 `reviews.is_hidden_by_admin=true` 설정 가능.

---

## 5. UI 디자인

기존 디자인 시스템 (Density 철학·무채색 팔레트·Tier 구조)을 그대로 따른다. 새 컬러 추가 금지.

### 5-1. 카드 (디렉토리·공고 리스트)

기존 카드 그대로. 라벨 슬롯에 추가만:

- **인증 배지**: 카드 우측 상단. `outline + ✓` 아이콘. 무채색.
  - "인증" (verified) — 검정 outline + 흰 배경
  - "실명 확인" (phone_verified only) — 회색 outline + 흰 배경
- **신뢰 메타 한 줄** (카드 하단 메타 영역): `거래 N건 · 응답률 N%` (값 없을 시 표시 안함)

### 5-2. 프로필 상세 페이지

기존 프로필 페이지 하단에 신규 섹션 4개 추가:

1. **신뢰 카드** — 4-cell horizontal grid
   - 인증 상태 / 거래 완료 수 / 응답률 / 평균 응답 시간
   - 각 셀은 1줄 라벨 + 큰 숫자 + 1줄 보조 설명
2. **포트폴리오 그리드** — 작품 카드 (썸네일·제목·일자·역할)
   - 카드 비율 1:1.2
   - 데스크탑 3~4 column, 모바일 1 column
   - is_featured 우선 정렬, 그 다음 display_order
3. **받은 태그 빈도** — 빈도순 칩 정렬
   - 가장 많이 받은 태그가 크게, 적게 받은 태그는 작게 (font-size 변주)
   - 단, 컬러는 무채색만. positive는 검정 텍스트, attention은 회색 텍스트 + outline
4. **리뷰 리스트** — 개별 리뷰 행
   - 작성자명 (실명) + 선택 태그 칩들 + 작성일 + 신고 버튼
   - 페이지네이션 10개씩

### 5-3. 작성 폼 (3종 모두 단일 페이지·세로 흐름)

- **인증 신청 폼** (`/mypage/verification`): 사업자번호 입력 + 이미지 업로드 + 안내 문구
- **포트폴리오 작성** (`/mypage/portfolios/new`, `/mypage/portfolios/[id]/edit`): 제목·일자·역할·예식장명·설명·이미지·대표 이미지 지정
- **리뷰 작성** (`/applications/[id]/review`): 태그 칩 토글 (최대 5개), 카운트 표시. 자유 텍스트 없음.

### 5-4. 어드민 패널

- `/admin/verifications` — 인증 요청 큐. 이미지·사업자번호 표시 + 승인/거절 + 거절 사유 입력
- `/admin/review-tags` — 마스터 태그 CRUD
- `/admin/reports` — 기존 신고 처리에 `review` target_type 추가, 리뷰 숨기기 액션

### 5-5. 마이페이지 보강

- `/mypage` 상단에 신뢰 위젯 (인증 상태 + 본인 카드 4-cell mini)
- `/mypage/portfolios` — 포트폴리오 관리 리스트
- `/mypage/reviews` — 받은 리뷰 보기, 작성 가능한 리뷰 큐

---

## 6. 점진적 도입 순서 (5 Phase)

각 Phase는 독립 PR. Phase 1 → 4 순서가 자연스럽고, Phase 1·3은 병렬 가능. Phase 5는 외부 서비스 의존이라 분리.

| Phase | 범위 | 가시 가치 | 의존성 |
|---|---|---|---|
| **1. 업체 인증** | DB 컬럼(전체) + Storage 버킷 + 사업자 인증 신청 폼 + 어드민 큐 + 카드 배지 | 카톡방 대비 최대 차별점, 단독 출시 가능 | 없음 |
| **2. 거래 완료 토글** | applications 컬럼 + 토글 버튼 + completed_deals_count 자동 계산 + 카드 메타 | Phase 4의 트리거. 단독으로도 "거래 N건" 노출 가치 | 없음 |
| **3. 포트폴리오** | portfolios 테이블 + Storage 버킷 + 작성 폼 + 프로필 그리드 + gallery 이관 | 디렉토리 콘텐츠 밀도 상승 | 없음 |
| **4. 리뷰** | review_tags·reviews 테이블 + 마스터 시드 + 작성 폼 + 프로필 노출 + 신고 처리 | 신뢰 레이어 완성 | Phase 2 (거래 완료) |
| **5. 개인 휴대폰 본인인증** | SMS 어댑터 + OTP 발송/검증 + UI | "실명 확인" 배지 활성화 | SMS 서비스 계약 |

---

## 7. 비기능 요구사항

- **파일 저장**: 모든 이미지는 Supabase Storage. localStorage에는 UI 상태만.
- **데이터 검증**: 리뷰 작성·인증 승인 등 핵심 mutation은 DB 함수(RPC)로 atomic하게.
- **알림 트리거**: 인증 결과·거래 완료·리뷰 작성은 모두 기존 `notifications` 테이블에 자동 INSERT.
- **무채색 디자인 유지**: 인증 배지·태그 칩 모두 무채색 + outline 기반. 별도 컬러 토큰 추가 금지.
- **Density 준수**: 신뢰 정보는 카드의 라벨 슬롯·메타 한 줄에 압축. 카드 비율을 어그러뜨리지 않는다.
- **모바일 정보 밀도**: 신뢰 메타는 모바일에서도 같은 줄에 표시. 폰트만 12~13px로 축소.

---

## 8. 본 spec에서 제외되는 범위

- DM·메시지 스레드
- 프리랜서 가용 캘린더
- 해시태그·스킬 태그 시스템
- 결제·유료 노출
- 모바일 앱
- SMS 서비스 실제 연동 (Phase 5 시작 시점에 결정)

위 항목은 별도 spec으로 분리하여 진행.

---

## 9. 마이그레이션·롤백 전략

- 모든 스키마 변경은 단일 SQL 파일 `supabase/migrations/2026-05-25-trust-layer.sql`로 작성
- 마이그레이션은 idempotent (IF NOT EXISTS, ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
- `profiles.gallery` 컬럼은 Phase 3에서 데이터 이관 후 Phase 4 마무리 시점에 DROP
- 롤백 시: 신규 테이블 DROP, 신규 컬럼 DROP. 기존 데이터에는 영향 없음

---

## 10. 성공 기준

- 업체가 사업자등록증을 업로드하여 인증 승인을 받으면 자신의 카드와 프로필에 "인증" 배지가 노출된다.
- 개인이 휴대폰 본인인증을 완료하면 "실명 확인" 배지가 노출된다.
- 거래가 양쪽 완료 처리된 후 양쪽 모두 한 번씩 태그 리뷰를 작성할 수 있다.
- 프로필에 거래 완료 수·응답률·평균 응답 시간이 자동 계산되어 표시된다.
- 포트폴리오는 작품 단위로 등록되며 프로필 페이지에 그리드로 노출된다.
- 모든 신규 UI는 기존 무채색 팔레트와 Density 철학을 준수한다.
