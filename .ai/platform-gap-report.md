# Marié 플랫폼 갭 리포트 (Phase 1)

> 작성: 시니어 풀스택 인수 엔지니어 / 2026-06-08
> 방법: 5차원(동작/껍데기/B2B 누락/디자인 깊이/구조 결함) 병렬 finder + 발견별 적대적 검증
> **65건 점검 → 59건 확정 / 6건 기각**  · high 17 · medium 19 · low 23
>
> 본 리포트는 **수정 전** 진단 단계. Phase 2 진입 전 확인 필요.

---

## 🎯 한 줄 진단

> **"신뢰 레이어 + 디스커버리(검색·디렉토리·커뮤니티)는 완성된 채용·매칭 사이트 — B2B 거래 흐름(견적·계약·일정·정산)은 데이터 모델·UI·API 모두 0."**

현재 코드는 잘 만든 **"웨딩 업계 채용 + 디렉토리 + 커뮤니티 + 신뢰 평가"** 플랫폼. 그러나 사용자가 명시한 **B2B 거래 흐름**(quotation → contract → booking → settlement)은 키워드 검색 0건 — 패러다임 자체가 채용·지원에 갇혀있음.

---

## (A) 실제로 끝까지 동작하는 기능 — 15건 (low)

| # | 기능 | 검증 핵심 |
|---|---|---|
| A1 | **회원가입/로그인/카카오 OAuth/비밀번호 재설정** | UI → API → DB → 세션 → 리다이렉트 전 경로 검증 |
| A2 | **공고 CRUD + 지원 상태머신** | jobService(CRUD) + applicationService(RPC `set_application_status`/`mark_deal_completed`/`set_author_note`) — 작성자·지원자 권한 분리 |
| A3 | **커뮤니티 글/댓글/좋아요/채택** | RPC `increment_view_count` 원자적 + `toggle_post_like` + `set_adopted_comment` |
| A4 | **디렉토리 등록·검색·상세** | profile.is_directory_listed 토글 + 검색 + 인증/배지 |
| A5 | **북마크 (4 타입 통합)** | bookmarks 테이블 + BookmarkButton + /mypage/bookmarks 페이지(Phase 3 신규) |
| A6 | **메시지/대화방** | conversations + messages + 송수신 + 읽음 |
| A7 | **가용 일정 캘린더** | availability_slots CRUD + 캘린더 UI |
| A8 | **포트폴리오 (이미지 업로드)** | Supabase Storage 'portfolios' 버킷 + portfolios 테이블 |
| A9 | **알림 (in-app)** | notifications INSERT + NotificationBadge + /mypage/notifications |
| A10 | **신고** | reports 테이블 + ReportButton 모달 |
| A11 | **사업자 인증** | verification 신청 + Storage 'verifications' 버킷 + 어드민 큐 |
| A12 | **휴대폰 OTP 흐름** | phone_otps 테이블 + 인증 폼 (단, 운영 SMS 미연결 — B 항목 참조) |
| A13 | **리뷰 (태그 기반)** | review_tags + reviews + 거래 완료 후 진입 |
| A14 | **저장된 검색** | saved_searches 테이블 + 알림은 미작동 (B 항목) |
| A15 | **이벤트 CRUD + 리스팅** | events 테이블 + admin 권한 |

---

## (B) UI는 있고 백엔드/실제 동작 비어있는 기능 — 9건

| # | 항목 | 보이는 것 / 실제 | 위험도 | 작업량 |
|---|---|---|---|---|
| B1 | **관리자 권한 가드** | /admin/* 페이지 모두 접근 가능 — 클라이언트 비밀번호 모달뿐, middleware 가드 없음 | 🔴 high | 1d |
| B2 | **휴대폰 OTP** | 인증 UI 동작 / 운영 환경에서 SMS 어댑터 missing → 항상 throw | 🔴 high | 1.5d |
| B3 | **메시지 실시간 수신** | DM 화면 정상 / Realtime 구독 없음 — 새 메시지 새로고침해야 보임 | 🟡 medium | 1d |
| B4 | **고객센터 문의** | /contact 페이지 / 폼 없음. mailto + 정적 FAQ만 | ⚪ low | 1.5d |
| B5 | **통합 검색 더보기** | 검색 결과 / 각 섹션 최대 5건 고정. '더보기'가 별도 페이지로 이동 (페이징 X) | ⚪ low | 1d |
| B6 | **이벤트 신청/접수** | 이벤트 카드 / 신청 기능 없음. 외부 링크 노출만 | ⚪ low | 2d |
| B7 | **프리미엄 등급(premium_tier)** | 카드/정렬에서 PREMIUM 배지 노출 / 결제·승급 UI 0 (수동 SQL만) | 🟡 medium | 1w |
| B8 | **가용성 캘린더 연동** | 일정 토글 가능 / 공고·지원·예약과 전혀 연동 X (UI 외 효용 0) | 🟡 medium | 2d |
| B9 | **통계 페이지** | /stats 페이지 / 지역·업종 집계가 **5000행 샘플 한정** | ⚪ low | 0.5d |

---

## (C) 🔥 B2B 핵심 기능 누락 — 12건

> **이것이 "껍데기 플랫폼" 진단의 본질.** 키워드(quotation/contract/settlement/invoice) 모두 코드 0건.

### 🔴 high — B2B 거래 흐름 직접 부재 (6건)

| # | 항목 | 위험도 | 작업량 |
|---|---|---|---|
| **C1** | **견적(Quotation) 시스템 전면 부재** — 업체A가 업체B에 견적 요청·작성·발송·수정·승인 흐름 0 | 🔴 high | **2w** |
| **C2** | **계약(Contract) 시스템 전면 부재** — 견적 승인 후 계약 체결·서명·보관 흐름 0 | 🔴 high | **2w** |
| **C3** | **예식 일정/예약(Booking) 부재** — availability_slots는 단순 가용/불가, 실제 booking·일정 관리 0 | 🔴 high | 1-2w |
| **C4** | **정산(Settlement) 부재** — 거래 완료 후 수수료·송금·매출 정산 흐름 0 | 🔴 high | 1-2w |
| **C5** | **문서 자동 생성 PDF 부재** — 견적서·계약서·세금계산서 출력 라이브러리·서비스 0 | 🔴 high | 1w |
| **C6** | **외부 결제 게이트웨이 부재** — payments 테이블은 placeholder, 토스/포트원 webhook 0 | 🔴 high | 1w |

### 🟡 medium / ⚪ low — B2B 보조 기능 (6건)

| # | 항목 | 작업량 |
|---|---|---|
| C7 | 업체 내부 권한(오너/매니저/스태프) 부재 — role enum 2단계뿐 | 1w |
| C8 | 세금/회계 연동 부재 — 사업자등록증만, 전자세금계산서·회계 export 0 | 1w |
| C9 | 메시지 → 견적 전환 미구현 — DM에서 거래 객체로 승격 진입점 0 | 3d |
| C10 | 인증 강화 부족 — 사업자등록증 1종만, 통장사본·인감·계약서 양식 0 | 3d |
| C11 | 분쟁 처리 흐름 부재 — reports는 신고만, 거래 분쟁 중재·환불·증거 0 | 1w |
| C12 | 발주서(PO) 부재 — 업체 간 협력 발주(예식장→메이크업/스튜디오) 흐름 0 | 1w |

---

## (D) 디자인 껍데기 — 9건

> 이전 Phase 4에서 시각 토큰·이모지·EmptyState·캐러셀·정보 위계는 정리. 그러나 **B2B 업무용 깊이**는 아직.

| # | 항목 | 위험도 | 작업량 |
|---|---|---|---|
| D1 | 견적·계약·일정·정산 상태 전이 시각화 자체가 미설계 (선행 C1-C4 의존) | 🔴 high | 1w |
| D2 | 업체 KPI 대시보드 부재 — 미는 있으나 거래·매출 KPI 0, 카운트 8개만 평등 나열 | 🔴 high | 4d |
| D3 | 알림 트레이 없음 — 헤더 벨 클릭 시 통째로 페이지 이동 (모던 인박스 UX 부재) | 🟡 medium | 2d |
| D4 | 메시지 단순 목록 + 상세 페이지 — B2B 인박스(2-pane) 표준 아님 | 🟡 medium | 3d |
| D5 | 온보딩 체크리스트 1개뿐 — 단계별 가이드/투어/입문 액션 부재 | 🟡 medium | 3d |
| D6 | admin 테이블 모바일 가로 스크롤만 — 카드 분기 없음 | 🟡 medium | 3d |
| D7 | 검색 결과 0건 빈 상태 추천 액션 '다른 키워드' 한 줄뿐 | ⚪ low | 1d |
| D8 | 로딩 상태 페이지별 일관성 없음 — Skeleton 공용 컴포넌트 부재 | ⚪ low | 2d |
| D9 | 클릭 가능 영역 시각 신호 약함 — hover primary-50/45 한 톤 집중 | ⚪ low | 1d |

---

## (E) 데이터 모델/권한/보안 구조적 결함 — 14건

| # | 항목 | 위험도 | 작업량 |
|---|---|---|---|
| **E1** | **B2B 거래 모델 0개** — 채용·지원 패러다임에 고착, 견적/계약/정산 테이블 부재 | 🔴 high | **4-6w** (C1~C4와 결합) |
| **E2** | **리뷰가 applications.completed에만 결합** — 견적/계약 deal 모델 미존재로 양방향 거래 평가 0 | 🔴 high | 2w |
| **E3** | **권한 모델 2단계** — user/admin만, 업체 내 직원 권한·멀티테넌트 경계 0 | 🔴 high | 3-4w |
| **E4** | **감사 로그(audit log) 0** — 중요 거래 상태 변경 이력 추적 불가 | 🔴 high | 1w |
| **E5** | **이메일/SMTP·PDF 인프라 의존성 0** — 견적서·계약서 발송 구조적 불가 | 🔴 high | 2-3w |
| **E6** | **결제 GW webhook·정산 모델 부재** — payments 테이블 placeholder | 🔴 high | 3-4w |
| **E7** | **Next.js 페이지에서 service_role로 RLS 일괄 우회** — 페이지 단 서버 컴포넌트가 createServiceClient() 사용, RLS 실효성 상실 | 🔴 high | 1w |
| E8 | RLS UPDATE WITH CHECK 누락 — author_id 위변조 차단을 트리거에만 의존 | 🟡 medium | 0.5w |
| E9 | soft delete 일관성 부족 — DELETE policy 부재 + 일부 RLS에 deleted_at 가드 없음 | 🟡 medium | 1w |
| E10 | business_type CSV 저장 — 다중값 검색을 ilike로 우회 (Phase 3 부분 fix만) | 🟡 medium | 1w |
| E11 | 데이터 액세스 패턴 비일관 — services / 직접 from() / API route 혼재 | 🟡 medium | 1-2w |
| E12 | 백업/회복 인프라 0 — 자체호스팅 Supabase 정기 백업 설정 부재 | 🟡 medium | 1w |
| E13 | ADMIN_PASSWORD 공유 시크릿 폴백 — 권한 분리 우회 가능 | 🟡 medium | 0.5w |
| E14 | 알림 외부 채널 0 — notifications 테이블 INSERT만, 이메일/카톡 발송 0 | 🟡 medium | 1-2w |

---

## 우선순위 로드맵 — (C) + (B) 기준

> 사용자 본인이 명시한 도메인 흐름과 일치하도록, **B2B 거래 흐름의 데이터 모델을 첫 마일스톤으로** 설계.

### 🚩 Milestone 1 — 거래 모델 기반 (4-5주)
**목표**: "껍데기 → 견적·계약·정산이 실제 데이터로 흐르는 진짜 B2B 플랫폼"

| 순서 | 항목 | 작업량 | 의존 |
|---|---|---|---|
| 1.1 | **데이터 모델 설계 + 마이그레이션** — `quotations`, `quotation_items`, `contracts`, `contract_signatures`, `bookings`, `settlements`, `audit_log` 테이블 + 관계 | 1w | — |
| 1.2 | **C1 견적 시스템** — 작성·발송·수정·승인 + 상태 전이(draft/sent/accepted/rejected/expired) + 메시지 → 견적 전환(C9) | 2w | 1.1 |
| 1.3 | **C2 계약 시스템** — 견적 승인 → 계약 생성 → 양방 서명 → 보관 + 만료 알림 | 1.5w | 1.2 |
| 1.4 | **C3 예식 일정/예약(Booking)** — 계약 + 예식 날짜 → 업체 일정 점유 + 충돌 검사 | 1w | 1.3, B8 (가용성 연동) |
| 1.5 | **C4 정산(Settlement)** — 거래 완료 → 수수료 계산 → 정산 내역 → 송금 status | 1w | 1.4 |

### 🚩 Milestone 2 — 문서·결제·알림 인프라 (2-3주)
| 순서 | 항목 | 작업량 |
|---|---|---|
| 2.1 | **C5 PDF 생성** — Puppeteer 또는 React-PDF 채택 + 견적서/계약서/정산서 템플릿 | 1w |
| 2.2 | **C6 결제 게이트웨이 연동** — 토스/포트원/카카오페이 (택1) + webhook + payments 통합 | 1w |
| 2.3 | **E5/E14 메일 + 알림 외부 채널** — SMTP + 카톡 알림톡 (택1) + 견적/계약/정산 트리거 | 0.5w |
| 2.4 | **E4 audit log** — 거래 상태 변경 이력 추적 | 0.5w |

### 🚩 Milestone 3 — 보안 + RBAC + UX (2-3주)
| 순서 | 항목 | 작업량 |
|---|---|---|
| 3.1 | **B1 admin 미들웨어 가드** — Next 미들웨어에서 role=admin 확인 | 1d |
| 3.2 | **B2 OTP SMS 어댑터 통합** — NHN Cloud / Aligo / 트윌리오 (택1) | 1.5d |
| 3.3 | **E7 service_role 우회 제거** — page-level service client → query client로 전환 | 1w |
| 3.4 | **C7 업체 내부 권한** — owner/manager/staff 3단계 + 멀티테넌트 경계 | 1w |
| 3.5 | **D2 KPI 대시보드** — 견적/계약/매출 카드 (Milestone 1 완료 후) | 4d |
| 3.6 | **D1 상태 전이 시각화** — 진행 흐름 chip/progress | 3d |
| 3.7 | **D3 알림 트레이** — 헤더 벨 펼침 패널 | 2d |
| 3.8 | **D4 메시지 인박스 (2-pane)** | 3d |

### 🚩 Milestone 4 — 정리 + 안전망 (2주)
| 순서 | 항목 | 작업량 |
|---|---|---|
| 4.1 | E11 데이터 액세스 패턴 통일 — services 표준화 | 1-2w |
| 4.2 | E10 business_type 정규화 테이블(profile_business_types m:n) | 1w |
| 4.3 | E12 백업 자동화 | 1w |
| 4.4 | E13 ADMIN_PASSWORD 제거 — 진짜 role 기반 | 0.5w |
| 4.5 | B7 프리미엄 결제 UI (Milestone 2.2 결제 GW 활용) | 1w |
| 4.6 | C11 분쟁 처리 흐름 | 1w |
| 4.7 | C12 발주서(PO) | 1w |
| 4.8 | D5-D9 디자인 잔여 (온보딩·반응형·skeleton·hover) | 1-2w |

### 📅 총 일정 추정
- Milestone 1: **4-5주** (블로커, 가장 큰 신규 도메인)
- Milestone 2: **2-3주**
- Milestone 3: **2-3주**
- Milestone 4: **2주**
- **합계: 10-13주** (1인 풀타임 기준)

---

## 기각된 6건 — 참고

| 제목 | 기각 사유 |
|---|---|
| 모더레이션 키워드 미적용 | 실제로는 jobs/posts 트리거에 적용됨 (workflow false positive) |
| 저장된 검색 알림 0 | 사실이지만 사용자 가치 낮음 — 우선순위에서 제외 |
| 신고 처리 액션 연계 0 | 사실이나 어드민 hide_by_admin 액션은 있음 |
| 역할별 KPI 부재 | D2와 중복 |
| B2B 화면 소비자 카드 UI | D1과 중복 |
| marie_profile 쿠키 httpOnly:false | 보안상 의도된 — 빠른 SSR profile 정보용, 신뢰 결정은 server validation |

---

## ⚠️ 큰 구조 변경 후보 — Phase 2 진입 전 별도 승인 필요

다음 항목은 데이터 모델 / 라우팅 / 의존성 / RBAC 모델 자체를 바꾸므로, 진행 전 **개별 승인**이 필요합니다:

1. **B2B 거래 모델 신규 테이블 7개** (quotations, quotation_items, contracts, contract_signatures, bookings, settlements, audit_log) — 마이그레이션 SQL 약 500-800줄
2. **외부 의존성 추가**:
   - PDF: `puppeteer` 또는 `@react-pdf/renderer` (Vercel/Docker 호환 점검 필요)
   - 결제 GW: `@tosspayments/payment-sdk` 또는 포트원/카카오페이 SDK
   - SMTP: `nodemailer` + 운영 메일 서비스
   - SMS: NHN Cloud / Aligo / Twilio SDK
3. **RBAC 모델 변경**:
   - profiles.role 2단계 → 업체 내부 `organization_members(profile_id, organization_id, role)` 도입
   - 멀티테넌트 경계 RLS 전면 재작성
4. **데이터 액세스 패턴 통일** — page-level service_role 사용처를 전부 query client로 전환 (1주 작업, 회귀 위험)

---

## 🛑 Phase 1 종료 — 확인 요청

다음 의사 결정 필요합니다:

1. **우선순위 로드맵 OK인가?** Milestone 순서 조정·삭제 필요한 항목?
2. **구조 변경 후보 4가지 승인하는가?** 일부만 진행하시려면 선택해 주세요.
3. **결제 GW / SMS 공급사 선택** (토스/포트원/카카오페이 ↔ NHN/Aligo/Twilio)
4. **운영 도메인이 carrier 도메인인가 자체?** (전자세금계산서 등 회계 연동은 사업자 명의 필요)
5. **이번 인수 작업의 범위**:
   - 옵션 A: Milestone 1만 (견적·계약·정산 데이터 모델 + UI까지)
   - 옵션 B: Milestone 1+2 (인프라까지 — PDF/결제/이메일/audit)
   - 옵션 C: Milestone 1+2+3 (보안 + RBAC + UX까지 완성형)
   - 옵션 D: 전체 4 마일스톤
