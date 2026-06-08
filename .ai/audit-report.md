# Marié 감사 리포트 (Phase 1)

> 작성: 시니어 풀스택 인수 엔지니어 / 2026-06-08
>
> 방법: 3차원(인터랙션 버그 · 껍데기 동작 · 껍데기 디자인) 병렬 finder + 발견별 적대적 검증. 35건 점검 → **29건 확정** / 6건 기각. high 8 · medium 14 · low 7.
>
> 본 리포트는 **수정 전** 진단 단계. Phase 2 이후 본격 수정.

---

## 개요

| 차원 | 확정 | high | medium | low |
|---|---|---|---|---|
| (A) 인터랙션 버그 | 10 | 4 | 4 | 2 |
| (B) 백엔드 미연결 | 1 | 0 | 1 | 0 |
| (C) 디자인 껍데기 | 18 | 3 | 9 | 6 |
| **합계** | **29** | **7** | **14** | **8** |

> ※ (A) 안에 "기능 자체가 거짓"인 항목 4건이 섞여 있어 사실상 (B) 항목으로도 분류됨 — 표는 분류 우선순위에 따른 1차 분류.

---

## (A) 인터랙션 버그 — 10건 확정

### A-1 🔴 `<Link>` 안에 `<Link>` 중첩 — 사용자 호소 "1클릭 → 다중 클릭" 일부 원인
**위험도**: high  
**위치**: [src/features/mypage/MyPageTabs.tsx:220-251](src/features/mypage/MyPageTabs.tsx#L220-L251)

| 차원 | 내용 |
|---|---|
| 보이는 것 | 받은/보낸 지원 카드. 카드 전체 클릭 → 공고 상세로 이동 + 거래 완료 행은 추가로 "리뷰 작성" 링크가 안에 있음 |
| 실제 | `<Link>` 안에 `<Link>` 중첩 → 브라우저 HTML 파서가 outer anchor를 강제 종료 후 inner anchor를 sibling으로 재배치 → 같은 anchor가 두 조각으로 쪼개져 클릭 위치에 따라 동시 네비게이션 발생 |
| 근본 원인 | HTML5 스펙(§13.2.6.4.7) 위반. `e.stopPropagation()`으로는 파서 시점 재배치를 못 막음 |
| 수정 | outer Link → `div + onClick(router.push)` 또는 inner Link 영역을 카드 영역과 시각·DOM 모두 분리 |

### A-2 🔴 Jobs 필터 드롭다운에 outside-click 닫힘 없음
**위험도**: high  
**위치**: [src/features/jobs/components/JobsPageContent.tsx:230-512](src/features/jobs/components/JobsPageContent.tsx#L230-L512)

| 차원 | 내용 |
|---|---|
| 보이는 것 | 지역 / 업종 / 고용형태 3개 드롭다운. 하나 열면 inline panel이 펼쳐짐 |
| 실제 | drop panel이 absolute가 아닌 **flow 안에 inline block**으로 배치 → 다른 필터 행과 시각적으로 겹침. 외부 클릭으로 닫는 핸들러 없음 — 다른 필터 버튼 클릭 시 panel이 안 닫혀 클릭 영역이 충돌함 |
| 근본 원인 | 드롭다운 패널을 `position: absolute` + outside-click ref listener 없이 inline div로 구현 |
| 수정 | 패널을 absolute로 분리 + Headless UI Popover 패턴 또는 mousedown capture phase outside-click |

### A-3 🔴 헤더 "저장한 업체" 하트 → /directory 전체로 이동 (거짓 약속)
**위험도**: high  
**위치**: [src/shared/components/HeaderClient.tsx:106-110](src/shared/components/HeaderClient.tsx#L106)

| 차원 | 내용 |
|---|---|
| 보이는 것 | 우상단 ♥ 아이콘, `aria-label="저장한 업체"` |
| 실제 | `<Link href={ROUTES.DIRECTORY}>` — 사용자별 북마크 필터 없는 전체 디렉토리. `/mypage/bookmarks` 라우트 없음. `ROUTES.MYPAGE_BOOKMARKS` 상수 없음 |
| 근본 원인 | 북마크 페이지 미구현 상태에서 헤더 아이콘만 먼저 만들고 임시 연결 |
| 수정 | (a) 아이콘 제거 / (b) `/mypage/bookmarks` 라우트 신설 / (c) 라벨 정정 |

### A-4 🔴 헤더 nav '노하우' 카테고리 값 불일치 (tip vs tips)
**위험도**: high  
**위치**: [src/shared/components/HeaderClient.tsx:14](src/shared/components/HeaderClient.tsx#L14)

| 차원 | 내용 |
|---|---|
| 보이는 것 | 카테고리 nav "노하우" 탭 |
| 실제 | `href=?category=tip` (단수). DB의 `POST_CATEGORIES.value`는 `tips` (복수). community/page.tsx:36 `eq('category', ...)` 정확 매칭 → **항상 0건 결과** |
| 근본 원인 | 상수와 nav 링크 매뉴얼 동기화 실패 |
| 수정 | `tip` → `tips`, POST_CATEGORIES 상수 import해서 매뉴얼 string 제거 |

### A-5 🔴 Jobs '인증 업체만' / '거래 이력 있음' 토글이 실제 필터링 안 됨
**위험도**: high  
**위치**: [src/app/(main)/jobs/page.tsx:27, 51-56](src/app/(main)/jobs/page.tsx#L27)

| 차원 | 내용 |
|---|---|
| 보이는 것 | 활성 토글 시 보라 배경 + ✓ 표시. URL `?verified=1` `?completed=1`로 반영 |
| 실제 | 서버 쿼리에 foreign-table 조인 `!inner` 누락 → join이 LEFT가 되어 `profiles.verification_status='verified'` 필터가 적용되지만 *match 안 되는 row*도 통과 |
| 근본 원인 | Supabase PostgREST embed 시 `!inner` 명시 안 함 → outer join으로 fallback |
| 수정 | `.select('*, author:profiles!author_id!inner(...)')` 형태로 inner join 명시 |

### A-6 🟡 JobStatusMenu fixed inset-0 오버레이 — 다른 행 클릭 흡수
**위험도**: medium  
**위치**: [src/features/jobs/components/JobStatusMenu.tsx:54-59](src/features/jobs/components/JobStatusMenu.tsx#L54)

| 차원 | 내용 |
|---|---|
| 보이는 것 | 행 A 메뉴 열어둔 채 행 B '상태 ▾' 클릭 → 두 번 클릭해야 열림 |
| 실제 | open===true일 때 `<button className="fixed inset-0 z-10">`이 viewport 전체 덮음 → 다른 행 트리거가 오버레이 아래에 깔려 1차 클릭이 흡수 |
| 근본 원인 | 외부 클릭을 viewport fixed 버튼으로 구현 |
| 수정 | mousedown capture phase listener 또는 inline relative dropdown |

### A-7 🟡 헤더 CAT_NAV 활성 표시가 모든 Jobs 서브카테고리 동시 활성화
**위험도**: medium  
**위치**: [src/shared/components/HeaderClient.tsx:181](src/shared/components/HeaderClient.tsx#L181)

| 차원 | 내용 |
|---|---|
| 보이는 것 | `/jobs?businessType=studio` 진입 시 카테고리 nav 활성 탭 표시 |
| 실제 | `pathname.startsWith(c.href.split('?')[0])` 조건 → `/jobs` 경로면 디자인·노하우·스튜디오·메이크업·플래너·사회축가·파트너섭외 모두 active 됨 |
| 근본 원인 | active 비교 시 query string은 무시 — pathname prefix만 사용 |
| 수정 | full href + searchParams로 정확히 매칭 |

### A-8 🟡 Jobs '마감/채용완료' 공고가 결과에 그대로 섞임
**위험도**: medium  
**위치**: [src/app/(main)/jobs/page.tsx:25-73](src/app/(main)/jobs/page.tsx#L25)

| 차원 | 내용 |
|---|---|
| 보이는 것 | 카드에 "마감" 배지가 일부 표시됨 |
| 실제 | 쿼리에서 마감 공고(`status='closed'` 또는 `deadline < now`) 자동 제외 안 함. status=open 명시 없음 |
| 근본 원인 | jobs/page.tsx getJobs()에 마감 가드 누락. 카드 UI 측에서만 마감 표시 |
| 수정 | 기본 쿼리에 `.eq('status', 'open').or('deadline.is.null,deadline.gte.now')` |

### A-9 🟡 고객센터 FAQ '비밀번호 찾기' 안내하지만 페이지 없음
**위험도**: medium  
**위치**: [src/app/(main)/contact/page.tsx:44](src/app/(main)/contact/page.tsx#L44)

| 차원 | 내용 |
|---|---|
| 보이는 것 | FAQ "비밀번호를 잊어버렸어요" → "로그인 페이지에서 비밀번호 찾기" 안내 |
| 실제 | 로그인 페이지에 "비밀번호 찾기" 링크/페이지 자체가 없음. `/forgot-password` 라우트 부재 |
| 근본 원인 | FAQ 카피만 있고 실제 기능 미구현 |
| 수정 | (a) FAQ 카피 정정 / (b) `/auth/forgot-password` + Supabase `resetPasswordForEmail` 연결 |

### A-10 ⚪ HeaderClient 프로필 메뉴 외부클릭 오버레이 (일부 클릭 흡수)
**위험도**: low  
**위치**: [src/shared/components/HeaderClient.tsx:130-146](src/shared/components/HeaderClient.tsx#L130)

| 차원 | 내용 |
|---|---|
| 보이는 것 | 프로필 메뉴 열어둔 채 본문 카드 클릭 → 첫 클릭은 메뉴 닫기만 됨 |
| 실제 | `<div className="fixed inset-0 z-10">`가 본문 전체 덮음. 본문 클릭은 카드 핸들러 대신 메뉴 닫기로 소비 |
| 근본 원인 | A-6과 동일 — fixed overlay outside-click 패턴 |
| 수정 | A-6과 동일 방식 |

---

## (B) 프론트엔드만 있고 백엔드 없는 기능 — 1건 확정 + A-3·A-4·A-5·A-9 사실상 동일 분류

### B-1 🟡 Jobs 결과 툴바 '최신 등록순' 라벨이 하드코딩
**위험도**: medium  
**위치**: [src/features/jobs/components/JobsPageContent.tsx:555](src/features/jobs/components/JobsPageContent.tsx#L555)

| 차원 | 내용 |
|---|---|
| 보이는 것 | "최신 등록순" 정렬 라벨. 다른 사이트는 클릭하면 드롭다운으로 인기순/마감임박 변경 |
| 실제 | 라벨은 정적 텍스트. 정렬 변경 UI 없음. 실제 쿼리는 `order('is_promoted', desc).order('created_at', desc)` — 항상 promoted 우선 |
| 근본 원인 | 정렬 변경 UI 미구현인데 라벨로 흉내 |
| 수정 | 드롭다운 추가 + URL `?sort=` 파라미터 + 서버 쿼리 반영 |

### 보조 분류 (인터랙션 버그로 분류했지만 사실상 미연결)
- **A-3** 하트 아이콘 → 거짓 라우트
- **A-4** 노하우 nav → 잘못된 카테고리
- **A-5** 인증/거래 토글 → join 잘못
- **A-9** 비밀번호 찾기 → 페이지 없음

---

## (C) 디자인 껍데기 — 18건 확정

### 🔴 high (3건)

#### C-1 EmptyState 컴포넌트 있지만 빈 상태가 모두 인라인으로 다시 그림
**위치**: [src/shared/components/EmptyState.tsx](src/shared/components/EmptyState.tsx)  
**문제**: 공용 컴포넌트가 있는데 jobs/community/directory/mypage 각 빈 상태가 모두 다른 톤·여백·문구로 인라인 구현. 사용자에게 일관성 깨짐  
**수정 방향**: 공용 `<EmptyState>` 강제 사용 + 페이지별 illustration prop 받기

#### C-2 Job/Company 카드 썸네일이 의미 없는 이모지 배경 — 실제 사진 0장
**위치**: HomeContent.tsx, JobCard.tsx, CompanyCard.tsx + globals.css 285-289  
**문제**: 카드 면적 60%가 그라데이션 + 큰 이모지(💍 👗 📸 ...). 콘텐츠와 무관한 장식이 데이터 면적을 잡아먹음. 실제 업체 로고/포트폴리오는 한 장도 노출 안 됨  
**수정 방향**: profile.profile_image / job.image이 있으면 우선 노출. 없으면 회사명 이니셜 + 무채색 배경 (이모지 제거)

#### C-3 Job/Company 카드의 가짜 "거래 0건 · 응답률 0%" 모든 신규 업체에 노출
**위치**: HomeContent.tsx:295, CompanyCard.tsx:49  
**문제**: 데이터 없으면 카드에 영구히 "거래 0건 · 응답률 0%" — 신규 업체에게 부정적. 가짜 평점 시스템 흉내  
**수정 방향**: 값이 0이면 메타 숨기기 또는 "신규" 배지로 전환

### 🟡 medium (9건)

| # | 제목 | 위치 |
|---|---|---|
| C-4 | JobsPageContent 드롭다운 패널이 flow 안 inline — absolute 부재로 다른 행 위 겹침 | JobsPageContent.tsx:365-511 |
| C-5 | HomeContent h-scroll — 키보드/터치 가이드·스크롤 인디케이터 없음 | HomeContent.tsx:143-146 |
| C-6 | JobListRow 메타라인 5-6배지 같은 굵기 나열 — 정보 위계 붕괴 | JobListRow.tsx:64-70 |
| C-7 | JobsPageContent 필터 — focus ring·dropdown ARIA 누락 (키보드 접근성) | JobsPageContent.tsx:232, 364-438, 645 |
| C-8 | MyPage 하단 8개 WorkspaceMetric 카드가 동일 모양으로 늘어서 노이즈 | mypage/page.tsx:258-311 |
| C-9 | Directory 상세 — 8개 섹션 카드가 모두 동일한 `border + rounded-xl + p-6` 반복 | directory/[id]/page.tsx:117-310 |
| C-10 | JobsPageContent 빈 상태 / HomeContent EmptyHint / EmptyState 톤 3종이 모두 다른 깊이 | JobsPageContent.tsx:575 |
| C-11 | HomeContent promo-card — 분홍/보라 그라데이션이 무채색 정책 위반 | globals.css:317-326 |
| C-12 | Job 카드 "PREMIUM/추천/인증" 배지 위계 불명확, 같은 슬롯에 다른 의미 | HomeContent.tsx:244-249, CompanyCard.tsx:33-38 |

### ⚪ low (6건)

| # | 제목 | 위치 |
|---|---|---|
| C-13 | JobCard 이모지/그라데이션이 `idx` 의존 — 같은 위치 카드는 항상 같은 그림 | JobCard.tsx:19-23 |
| C-14 | 메시지·신고에서 `alert/confirm` 사용 — Toast 인프라와 불일치 | ReportButton.tsx:40-42 |
| C-15 | Header CAT_NAV 첫 탭에만 녹색 🌿 이모지 — 미니멀 팔레트 위반 | HeaderClient.tsx:170 |
| C-16 | HomeContent 카테고리 그리드 — 10개 중 1개만 `bg-primary-50` 의미 없는 강조 | HomeContent.tsx:29-40 |
| C-17 | MyPage quick-actions 8개 `platform-link-tile`이 모두 같은 모양 평등 나열 | mypage/page.tsx:224-236 |
| C-18 | Directory 상세 갤러리 — `gallery` 필드 deprecated 주석만, 정리 안 됨 | directory/[id]/page.tsx:283-307 |

---

## Phase 2-4 권고 작업 순서

### Phase 2 — 인터랙션 버그 우선
1. **A-2** Jobs 드롭다운 outside-click + absolute positioning (사용자 호소 "1클릭→4-5클릭" 직접 원인)
2. **A-1** MyPageTabs Link 중첩 → div + router.push
3. **A-6** JobStatusMenu / **A-10** HeaderClient 외부클릭 패턴 — 공용 hook 추출 (`useOutsideClick`)
4. **A-7** CAT_NAV active 매칭

### Phase 3 — 백엔드 미연결
5. **A-3** 하트 아이콘 — `/mypage/bookmarks` 라우트 신설 + bookmarks 조회 페이지
6. **A-4** '노하우' tip → tips (또는 POST_CATEGORIES 정합화)
7. **A-5** verified/completed 토글 → `!inner` join 적용
8. **A-8** 마감 공고 자동 제외
9. **A-9** 비밀번호 찾기 — `/auth/forgot-password` + Supabase resetPasswordForEmail
10. **B-1** 정렬 드롭다운 + URL ?sort= 반영

### Phase 4 — 디자인 깊이
11. **C-2** 카드 썸네일 — 이미지 우선 + 무채색 fallback (이모지 제거)
12. **C-3** 신규 업체 부정 라벨 제거
13. **C-1** EmptyState 공용 컴포넌트 강제
14. **C-6 + C-8 + C-9** 정보 위계 정리 + 8x 카드 시각 다양화
15. **C-7** 접근성 — focus ring + ARIA
16. **C-11 + C-15 + C-16** 미니멀 팔레트 잔재
17. **C-14** alert/confirm → Toast 통일
18. 나머지 low 정리

---

## 기각된 6건

| 제목 | 기각 사유 |
|---|---|
| NavigationProgress history.pushState 몽키패치 | cleanup 정상, 실제 동작 OK |
| MyPageTabs 내 공고 카드 outer div 클릭 영역 강조 | hover 효과는 의도된 시각 강조 |
| JobsPageContent 필터 버튼 `type="button"` 누락 | Hero 외곽 div가 form 아니라 실제 위험 없음 |
| JobFilters debounced search useEffect 의존성 | 실제로는 작동, 추정 false positive |
| CommentSection skeleton key={i} | loading 중에만 사용 — 패턴 일관성은 낮은 우선순위 |
| 검색 결과 카드 가짜 통계 | C-3과 중복, C-3로 처리 예정 |

---

## 다음 단계

- **Phase 2 진행 전 검토 요청**: 위 권고 순서 OK인지? 우선순위 조정 필요한지?
- 큰 구조 변경 후보(이번 리포트 기준):
  - `useOutsideClick` 공용 hook 신규
  - `/mypage/bookmarks` 라우트 신설
  - `/auth/forgot-password` 라우트 신설
  - EmptyState 컴포넌트 강제 사용 (인라인 구현 제거)
  → 이건 Phase 진행 직전 별도 승인 요청
