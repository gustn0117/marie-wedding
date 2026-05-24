# 마리에.md 디자인 시스템 전역 적용 — 설계

> **목표:** `마리에.md`의 구조적 디자인 원리(Density · Hierarchy · Information First · Repetition · Action Always Visible)를 전 페이지에 일관 적용.
> **범위:** 전 페이지(홈, jobs, directory, community, events, search, mypage). 데이터 모델·DB 스키마는 변경하지 않는다. 시각 시스템과 레이아웃만 재구성.

---

## 1. 작업 원칙

1. **컬러 팔레트는 유지** — 기존 네이비(#1B2A4A) primary + 무채색은 정보형 사이트 원칙과 이미 부합.
2. **데이터 무변경** — Tier/광고 데이터 필드는 도입하지 않는다. 위계는 **동적 규칙**(작성 시점·마감 임박·is_pinned·posting_type 등 기존 필드)으로 시각만 부여.
3. **컨테이너 폭 확장** — `max-w-[1200px]` → `max-w-[1440px]`(레이아웃) / 1600px(jobs·directory 리스트). 좌우 패딩 1-2%.
4. **컴팩트 우선** — 카드 gutter 12-16px, 카드 내부 패딩 14-18px, 라벨 rounded 2-4px.
5. **검색바 최상단 sticky** — 헤더 검색은 이미 OK, 그대로 유지.
6. **모바일에서도 정보 밀도 유지** — 폰트만 12-14px로 축소, 정보 항목은 그대로.

---

## 2. 디자인 토큰 — 단계 1

### 2-1. `tailwind.config.ts`

추가/조정:
- `colors.state`: `urgent` `new` `verified` `promoted` 4종(시맨틱)
- `colors.surface.alt`: 카드 vs 페이지 미세 차이용 (#FAFBFC)
- `borderRadius`: `DEFAULT: '0.25rem'` (4px), `lg: '0.375rem'` (6px) — 축소
- `fontSize`: micro(11px), small(12px), body(14px), body-lg(15px), h4(18px), h3(20px), h2(24px), h1(28px) — 1.2배 좁은 점프
- `boxShadow`: cinematic 그림자 제거, `card-hover: 0 1px 0 0 var(--primary)` 같은 보더 강조형

### 2-2. `globals.css` — 컴포넌트 클래스

| 클래스 | 변경 |
|--------|------|
| `.btn-primary/-secondary/-outline` | 패딩 px-5/py-2 (살짝 컴팩트), rounded 4px 유지 |
| `.card` | rounded 0(평면) — 보더 + 미세 hover. `hover:border-primary` 통일 |
| `.badge-*` | rounded 2px, padding 0.25em/0.5em, 4종 상태 컬러 정리 |
| `.tier-1`/`.tier-2`/`.tier-3` | 카드 배경/보더 강도 차등 유틸 (Tier 1=accent border, Tier 2=primary border 1px 굵게, Tier 3=default) |
| `.filter-chip` | 활성 필터 칩 — rounded-sm, X 버튼 포함 |
| `.list-row` | jobs 컴팩트 행(현재 인라인 스타일) 컴포넌트화 |

### 2-3. 신규 시맨틱 컬러 사용 규칙

| 토큰 | 사용처 |
|------|--------|
| `state-urgent` (red-600) | 마감 ≤ 3일, 긴급 라벨 |
| `state-new` (emerald-600) | 작성 ≤ 7일, NEW 라벨 |
| `state-verified` (blue-600) | 인증 업체, 우수 라벨 |
| `state-promoted` (amber-600) | 광고/프리미엄(현재 미사용, 클래스만 준비) |

---

## 3. 위계(Tier) — 동적 규칙

데이터 필드 없이 다음 규칙으로 카드 클래스 자동 결정.

```ts
// shared/utils/tier.ts
export function getJobTier(job: Job): 2 | 3 {
  if (daysSince(job.created_at) <= 3) return 2;        // 신규 강조
  if (job.deadline && daysUntil(job.deadline) <= 3) return 2;  // 마감 임박
  return 3;                                             // 일반
}
```

- **Tier 1**: 광고/프리미엄 자리 — 현재 데이터 필드 없으므로 본 작업에선 클래스만 정의하고 사용 안 함
- **Tier 2**: 강조 보더(2px primary) + NEW/마감 라벨, 표준 카드 크기
- **Tier 3**: 기본 카드

같은 페이지에 Tier 2와 3이 자연스럽게 섞이도록 정렬 그대로 유지. 별도 섹션 헤더(`주요 채용`, `프리미엄 공고`) 분리는 데이터 도입 이후 단계.

---

## 4. 라벨 시스템 — 4유형

```
[상태] 긴급 마감 NEW 종료     — fill 강조 색
[속성] 정규직 신입 서울       — outline 무채색
[자랑] 인증 우수업체 매출1위   — 신뢰 색(blue) outline
[카테고리] 드레스 메이크업    — text + 미세 보더
```

각 카드는 **최대 4개 라벨**, 첫 번째는 항상 상태 라벨, 줄 바꿈 허용, gap 4px.

---

## 5. 페이지별 적용

### 5-1. 글로벌 (`src/app/(main)/layout.tsx`)
- 컨테이너 `max-w-[1440px]` + `px-4 sm:px-6 lg:px-8` (viewport의 1-2%)
- jobs/directory 페이지는 자체 컨테이너로 1600px 사용 가능하게 layout이 강제하지 않음

### 5-2. 홈 (`src/app/page.tsx` / `HomeContent.tsx`)
- 풀스크린 hero 금지(이미 없음). 대신 **상단 빠른 진입 카드 3-4개**(채용/디렉토리/이벤트/커뮤니티)
- 그 아래 **최신 채용 8개 + 최신 글 5개 + 최신 이벤트 4개**를 한 화면 안에 노출
- 우측에 사이드 카드(추천 업체 / 인기 검색어) 옵션 — 데스크탑만

### 5-3. 채용(`/jobs`) — `JobsPageContent.tsx`
- 컨테이너 `max-w-[1600px]`
- **상단 필터바형(B)** 유지하되 칩 rounded-full → rounded-sm
- 활성 필터 칩 영역을 필터바 안으로 통합(현재 분리되어 보임)
- **2가지 보기 토글 추가**: List(현재) / Grid(JobCard 사용) — 우상단
- List 모드: 한 행 정보 7개(썸네일·제목·회사·지역·고용형태·업종·급여·마감·상태라벨) — 현재와 비슷하지만 라벨 시스템 적용
- Grid 모드: lg 3-col, xl 4-col, 2xl 5-col
- 페이지네이션은 ... 생략 표시 포함(현재 1~10 한정 → 전체 페이지 수 대응)

### 5-4. 디렉토리(`/directory`) — 사이드바형으로 전환
```
┌─────────────┬──────────────────────────────┐
│ Filter      │  Header (검색 + 정렬 + 토글)  │
│ - 검색       ├──────────────────────────────┤
│ - 업종(체크)  │                              │
│ - 지역(체크)  │  Grid 4~5 col                │
│ - 인증여부    │  카드 정보 7개                │
│ - 정렬       │                              │
│ 초기화       │                              │
└─────────────┴──────────────────────────────┘
```
- 사이드바: 데스크탑 `w-[260px]`(전체의 18%), sticky top-[헤더 높이]
- 모바일: 우상단 필터 버튼 → 풀스크린 드로어
- CompanyCard 정보 추가: 등록일·지원 가능 여부·인증 라벨(있을 때)·bio 줄임 → 7-10개

### 5-5. 커뮤니티(`/community`)
- 현재 `max-w-3xl` → `max-w-[1200px]` 확장하되 본문은 좌측, 우측에 인기글/카테고리 사이드(데스크탑만)
- 게시글 리스트는 컴팩트 행(이미 PostList 그렇게 구성됨, 점검만)
- 카테고리 필터바는 상단 필터바형 유지

### 5-6. 이벤트(`/events`)
- 현재 `max-w-4xl` → `max-w-[1440px]`
- 카드 grid `sm:2 lg:3 xl:4`
- 고정 공지 섹션은 Tier 2 보더로 시각 차별
- EventCard: rounded 0, shadow 제거(이미 진행 중), 텍스트 위계만으로 강조

### 5-7. 검색(`/search`)
- 결과 페이지 — 좌측 필터(섹션별: 채용/업체/글/이벤트), 우측 통합 결과
- 결과 수 실시간 표시(`아리아라이브`)

### 5-8. 마이페이지(`/mypage`)
- 좌측 메뉴(프로필/내 공고/내 글/스크랩/설정) — 사이드바 18%
- 우측 콘텐츠 — 표 위주 컴팩트 행

---

## 6. 헤더 (이미 좋음 — 미세 조정만)
- 검색바: 둥근 모서리 `rounded-full` → `rounded-md`(가이드 알약형은 카테고리 칩에만)
- 네비 링크 hover: 미세 underline 추가(현재 색 변화만)
- 모바일 검색바: 헤더 하단 sticky 유지

---

## 7. 모션
- 모든 hover 150ms / state 200ms 통일 (`transition-colors duration-150`)
- `prefers-reduced-motion` 대응: `motion-reduce:transition-none` 유틸 클래스화

---

## 8. 접근성
- 모든 상태 라벨에 색 + 텍스트 병행(이미 됨, 점검만)
- Pagination에 `aria-current="page"` 추가
- 검색 결과 수에 `aria-live="polite"`
- 카드 `<article>`, 필터 `<aside>` 시맨틱 마크업

---

## 9. 작업 단위(요약)

| # | 단위 | 파일 |
|---|------|------|
| 1 | 토큰 정비 | `tailwind.config.ts`, `globals.css` |
| 2 | 공유 유틸 | `src/shared/utils/tier.ts`(신규), `src/shared/utils/label-style.ts`(신규) |
| 3 | 공유 컴포넌트 | `Badge`(신규 4종 통합), `FilterChip`(신규), `ViewToggle`(신규), 기존 `Pagination`/`EmptyState` 점검 |
| 4 | 글로벌 레이아웃 | `(main)/layout.tsx` 컨테이너 확장 |
| 5 | 헤더 | `HeaderClient.tsx` 검색바 모서리 |
| 6 | 홈 | `HomeContent.tsx` 밀도 강화 |
| 7 | 채용 | `JobsPageContent.tsx`, `JobCard.tsx`, `JobList.tsx` |
| 8 | 디렉토리 | `directory/page.tsx`, `CompanyFilters.tsx`(사이드바화), `CompanyCard.tsx`, `CompanyList.tsx` |
| 9 | 커뮤니티 | `community/page.tsx`, `PostList.tsx`, `PostFilters.tsx` |
| 10 | 이벤트 | `events/page.tsx`(인라인 EventCard 컴포넌트 분리) |
| 11 | 검색 | `search/page.tsx` |
| 12 | 마이페이지 | `mypage/*` |
| 13 | 검증 | 빌드 + `npm run lint` + 주요 페이지 수동 확인 |

---

## 10. 명시적 비목표(YAGNI)

- 광고/프리미엄 DB 필드 추가 — 별도 작업으로 분리
- 다크 모드 — 본 작업 외
- 디자인 토큰의 컬러 값 자체 변경(네이비 톤 유지)
- 새 폰트 도입(Pretendard 유지)
- 무한 스크롤 — 페이지네이션 유지

---

## 11. 셀프 체크리스트(완료 기준)

- [ ] 1440px 화면에서 jobs/directory 첫 화면 카드 12개 이상 보임
- [ ] 모든 카드/행이 라벨 1개 이상 노출(상태 라벨 우선)
- [ ] 디렉토리에 사이드바 필터 존재(데스크탑)
- [ ] 활성 필터가 칩 형태로 누적 표시 + 개별 X
- [ ] 검색바가 모든 페이지 헤더 상단에 존재
- [ ] 모바일 첫 화면에 카드 3개 이상 보임
- [ ] 모든 hover 모션 ≤ 200ms
- [ ] `npm run build`, `npm run lint` 통과
