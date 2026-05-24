# 마리에 디자인 시스템 전역 적용 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `마리에.md`의 밀도·위계·정보 우선 원칙을 전 페이지에 일관 적용. 데이터/스키마 무변경, 시각·레이아웃만 재구성.

**Architecture:** (1) 디자인 토큰 정비 → (2) 공유 유틸/컴포넌트 신설 → (3) 글로벌 레이아웃 폭 확장 → (4) 페이지별 적용(홈/jobs/directory/community/events/search/mypage). 각 단계는 빌드 + lint 검증 후 커밋.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, Pretendard 폰트.

**Spec:** `docs/superpowers/specs/2026-05-24-design-system-application-design.md`

---

## Task 1: 디자인 토큰 정비

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: tailwind.config.ts에 시맨틱 state 컬러 + 폰트 스케일 추가**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B2A4A',
          light: '#2E4470',
          dark: '#111D35',
          50: '#F0F3F8',
          100: '#D9E0ED',
          200: '#B3C1DB',
          300: '#7A92BA',
          400: '#4A6899',
          500: '#2E4470',
          600: '#1B2A4A',
          700: '#152240',
          800: '#111D35',
          900: '#0B1424',
        },
        secondary: {
          DEFAULT: '#F5F6F8',
          50: '#FAFBFC',
          100: '#F5F6F8',
          200: '#E8EBF0',
          300: '#D1D5DE',
          400: '#B8BFC9',
        },
        accent: {
          DEFAULT: '#4A6899',
          light: '#7A92BA',
          dark: '#2E4470',
          50: '#F0F3F8',
          100: '#D9E0ED',
          200: '#B3C1DB',
          300: '#7A92BA',
          400: '#4A6899',
          600: '#2E4470',
        },
        // 시맨틱 상태 컬러 (라벨 전용)
        state: {
          urgent: '#DC2626',       // 마감임박 (red-600)
          'urgent-bg': '#FEF2F2',  // red-50
          new: '#059669',          // 신규 (emerald-600)
          'new-bg': '#ECFDF5',     // emerald-50
          verified: '#2563EB',     // 인증 (blue-600)
          'verified-bg': '#EFF6FF',// blue-50
          promoted: '#D97706',     // 광고/프리미엄 (amber-600)
          'promoted-bg': '#FFFBEB',// amber-50
        },
        background: '#FFFFFF',
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#FAFBFC',
        },
        border: '#E5E7EB',
        'text-primary': '#1A1A1A',
        'text-secondary': '#4B5563',
        'text-muted': '#9CA3AF',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        // 정보형 사이트용 좁은 점프 (1.15~1.25배)
        'micro': ['11px', { lineHeight: '1.35' }],
        'small': ['12px', { lineHeight: '1.4' }],
        'body': ['14px', { lineHeight: '1.55' }],
        'body-lg': ['15px', { lineHeight: '1.5' }],
        'h4': ['17px', { lineHeight: '1.4' }],
        'h3': ['20px', { lineHeight: '1.35' }],
        'h2': ['24px', { lineHeight: '1.3' }],
        'h1': ['28px', { lineHeight: '1.25' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',  // 4px
        sm: '0.125rem',      // 2px
        md: '0.25rem',       // 4px
        lg: '0.375rem',      // 6px
      },
      transitionDuration: {
        'instant': '100ms',
        'quick': '150ms',
        'base': '200ms',
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: globals.css 컴포넌트 클래스 보강**

```css
/* src/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply font-sans text-gray-800 bg-white antialiased;
    font-feature-settings: "tnum" 1;
  }
  /* prefers-reduced-motion 대응 */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@layer components {
  /* === BUTTONS === */
  .btn-primary {
    @apply bg-primary text-white px-5 py-2 rounded-sm text-sm font-medium
           hover:bg-primary-dark transition-colors duration-150
           focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1
           disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-secondary {
    @apply bg-gray-100 text-gray-700 px-5 py-2 rounded-sm text-sm font-medium
           hover:bg-gray-200 transition-colors duration-150;
  }
  .btn-outline {
    @apply border border-primary text-primary px-5 py-2 rounded-sm text-sm font-medium
           hover:bg-primary hover:text-white transition-colors duration-150;
  }

  /* === INPUTS === */
  .input-field {
    @apply w-full px-3 py-2 border border-gray-300 rounded-sm bg-white text-sm
           text-gray-800 placeholder:text-gray-400
           focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
           transition-colors duration-150;
  }

  /* === CARDS === */
  .card {
    @apply bg-white rounded-sm border border-gray-200 p-4
           hover:border-gray-400 transition-colors duration-150;
  }
  /* Tier 시각 변형 */
  .card-tier-1 {
    @apply border-state-promoted/40 bg-state-promoted-bg/40;
  }
  .card-tier-2 {
    @apply border-2 border-primary/60;
  }

  /* === BADGES === */
  .badge {
    @apply inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-bold tracking-tight;
  }
  /* 상태(긴급도) — fill 강조 */
  .badge-urgent { @apply badge bg-state-urgent text-white; }
  .badge-new { @apply badge bg-state-new text-white; }
  .badge-promoted { @apply badge bg-state-promoted text-white; }
  /* 속성(분류) — outline 무채색 */
  .badge-attr { @apply badge bg-gray-100 text-gray-700 border border-gray-200; }
  /* 자랑(인증) — 신뢰 색 */
  .badge-verified { @apply badge bg-state-verified-bg text-state-verified border border-state-verified/30; }
  /* 카테고리(필터) — 약함 */
  .badge-category { @apply badge bg-primary-50 text-primary-600; }
  /* 기존 호환 */
  .badge-primary { @apply badge-category; }
  .badge-accent { @apply badge-attr; }

  /* === FILTER CHIPS (활성 필터 표시) === */
  .filter-chip {
    @apply inline-flex items-center gap-1 px-2.5 py-1 bg-primary/5 text-primary
           text-xs rounded-sm border border-primary/20;
  }

  /* === LIST ROW (컴팩트 행) === */
  .list-row {
    @apply flex items-start gap-4 px-4 py-3 border-b border-gray-100
           hover:bg-secondary-50 transition-colors duration-150;
  }
  .list-row:last-child { @apply border-b-0; }

  /* === NAVER-STYLE FORM (그대로 유지) === */
  .naver-form { @apply bg-white border-t border-b border-gray-300; }
  .naver-row { @apply flex border-b border-gray-200; }
  .naver-row:last-child { @apply border-b-0; }
  .naver-label {
    @apply w-[120px] px-5 py-4 text-sm font-semibold text-gray-700 bg-gray-50
           border-r border-gray-200 flex items-center shrink-0;
  }
  .naver-content { @apply flex-1 px-5 py-4; }
  .naver-input {
    @apply w-full px-0 py-1 bg-transparent border-0 text-[15px] text-gray-900
           placeholder:text-gray-400 focus:outline-none focus:ring-0;
  }
  .naver-title {
    @apply w-full px-0 py-2 bg-transparent border-0 text-2xl font-bold
           text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-0;
  }
  .naver-textarea {
    @apply w-full px-0 py-1 bg-transparent border-0 text-[15px] text-gray-900
           placeholder:text-gray-400 focus:outline-none focus:ring-0 resize-none;
  }
  .naver-pill { @apply px-3 py-1.5 text-sm border transition-colors; }
  .naver-pill-active { @apply bg-primary text-white border-primary; }
  .naver-pill-inactive {
    @apply bg-white text-gray-600 border-gray-300 hover:border-gray-500;
  }

  /* === RICH TEXT (그대로 유지) === */
  .rich-text-content h2 { @apply text-xl font-bold text-gray-900 my-3; }
  .rich-text-content h3 { @apply text-base font-bold text-gray-900 my-2; }
  .rich-text-content p { @apply my-1 leading-relaxed; }
  .rich-text-content strong, .rich-text-content b { @apply font-bold; }
  .rich-text-content em, .rich-text-content i { @apply italic; }
  .rich-text-content u { @apply underline; }
  .rich-text-content ul { @apply list-disc pl-6 my-2; }
  .rich-text-content ol { @apply list-decimal pl-6 my-2; }
  .rich-text-content li { @apply my-0.5; }
  .rich-text-content img, .rich-text-content .rich-text-image {
    @apply max-w-full h-auto my-3 rounded block;
  }
}

@layer utilities {
  .line-clamp-1 {
    overflow: hidden; display: -webkit-box;
    -webkit-box-orient: vertical; -webkit-line-clamp: 1;
  }
  .line-clamp-2 {
    overflow: hidden; display: -webkit-box;
    -webkit-box-orient: vertical; -webkit-line-clamp: 2;
  }
  .line-clamp-3 {
    overflow: hidden; display: -webkit-box;
    -webkit-box-orient: vertical; -webkit-line-clamp: 3;
  }
  /* 데스크탑 sticky 사이드바 */
  .sticky-sidebar {
    @apply lg:sticky lg:top-[120px] lg:self-start lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto;
  }
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공 (기존 클래스 사용처 호환성 점검)

- [ ] **Step 4: 커밋**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "design: 토큰·컴포넌트 클래스 정비

- 시맨틱 state 컬러 4종(urgent/new/verified/promoted) 추가
- 정보형 사이트용 좁은 폰트 스케일
- rounded 4px 기본화, 6px lg 정의
- Badge 4유형, Tier 카드 변형, filter-chip, list-row, sticky-sidebar 유틸"
```

---

## Task 2: 공유 유틸리티 — Tier·라벨

**Files:**
- Create: `src/shared/utils/tier.ts`
- Create: `src/shared/utils/labels.ts`

- [ ] **Step 1: tier.ts 작성 (위계 자동 판정)**

```ts
// src/shared/utils/tier.ts
import type { Job, Profile, Post, Event } from '@/types/database';

export type Tier = 1 | 2 | 3;

function daysSince(date: string | null | undefined): number {
  if (!date) return Infinity;
  const diff = Date.now() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function daysUntil(date: string | null | undefined): number {
  if (!date) return Infinity;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getJobTier(job: Pick<Job, 'created_at' | 'deadline'>): Tier {
  if (daysUntil(job.deadline) <= 3 && daysUntil(job.deadline) >= 0) return 2;
  if (daysSince(job.created_at) <= 3) return 2;
  return 3;
}

export function getPostTier(post: Pick<Post, 'created_at'>): Tier {
  if (daysSince(post.created_at) <= 1) return 2;
  return 3;
}

export function isUrgent(deadline: string | null | undefined): boolean {
  const d = daysUntil(deadline);
  return d >= 0 && d <= 3;
}

export function isNew(createdAt: string | null | undefined): boolean {
  return daysSince(createdAt) <= 3;
}

export function getDDayLabel(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  const d = daysUntil(deadline);
  if (d < 0) return '마감';
  if (d === 0) return 'D-DAY';
  if (d <= 30) return `D-${d}`;
  return null;
}
```

- [ ] **Step 2: labels.ts 작성 (라벨 스타일 헬퍼)**

```ts
// src/shared/utils/labels.ts
export type LabelKind = 'urgent' | 'new' | 'promoted' | 'verified' | 'attr' | 'category';

export function labelClass(kind: LabelKind): string {
  switch (kind) {
    case 'urgent': return 'badge-urgent';
    case 'new': return 'badge-new';
    case 'promoted': return 'badge-promoted';
    case 'verified': return 'badge-verified';
    case 'attr': return 'badge-attr';
    case 'category': return 'badge-category';
  }
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run lint`
Expected: 통과

- [ ] **Step 4: 커밋**

```bash
git add src/shared/utils/tier.ts src/shared/utils/labels.ts
git commit -m "feat(shared): tier/label 유틸 추가

- getJobTier/getPostTier: 작성일·마감일 기반 동적 위계 판정
- isUrgent/isNew/getDDayLabel: 상태 라벨 헬퍼
- labelClass: 라벨 종류 → CSS 클래스 매핑"
```

---

## Task 3: 공유 컴포넌트 — Badge/FilterChip/ViewToggle

**Files:**
- Create: `src/shared/components/Badge.tsx`
- Create: `src/shared/components/FilterChip.tsx`
- Create: `src/shared/components/ViewToggle.tsx`

- [ ] **Step 1: Badge.tsx**

```tsx
// src/shared/components/Badge.tsx
import { LabelKind, labelClass } from '@/shared/utils/labels';

interface BadgeProps {
  kind: LabelKind;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ kind, children, className = '' }: BadgeProps) {
  return (
    <span className={`${labelClass(kind)} ${className}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: FilterChip.tsx**

```tsx
// src/shared/components/FilterChip.tsx
interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export default function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="filter-chip">
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 -mr-1 p-0.5 hover:bg-primary/10 rounded-sm"
        aria-label={`${label} 필터 제거`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
```

- [ ] **Step 3: ViewToggle.tsx**

```tsx
// src/shared/components/ViewToggle.tsx
'use client';

export type ViewMode = 'list' | 'grid';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex border border-gray-300 rounded-sm overflow-hidden" role="group" aria-label="보기 방식">
      <button
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
        className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${
          value === 'list' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        리스트
      </button>
      <button
        onClick={() => onChange('grid')}
        aria-pressed={value === 'grid'}
        className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${
          value === 'grid' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        그리드
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
npm run lint
git add src/shared/components/Badge.tsx src/shared/components/FilterChip.tsx src/shared/components/ViewToggle.tsx
git commit -m "feat(shared): Badge/FilterChip/ViewToggle 컴포넌트 추가"
```

---

## Task 4: 글로벌 레이아웃 — 컨테이너 폭 확장

**Files:**
- Modify: `src/app/(main)/layout.tsx`

- [ ] **Step 1: layout.tsx 컨테이너 폭 1440px 확장 + 1-2% 패딩**

```tsx
// src/app/(main)/layout.tsx
import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8 py-4 sm:py-6">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: 확인 + 커밋**

```bash
npm run lint
git add src/app/(main)/layout.tsx
git commit -m "design(layout): 메인 컨테이너 1440px + 1-2% 패딩"
```

---

## Task 5: 헤더 검색바 모서리 보정

**Files:**
- Modify: `src/shared/components/HeaderClient.tsx`

- [ ] **Step 1: 검색바 rounded-full → rounded-md, 모바일 동일 적용**

`HeaderClient.tsx`에서 두 개의 검색바(데스크탑/모바일) 클래스 변경:
- `rounded-full overflow-hidden` → `rounded-md overflow-hidden`

```bash
# 데스크탑 검색바 (66번 라인 근방)
# 모바일 검색바 (252번 라인 근방)
```

수동 Edit 두 군데:

```tsx
// Before
<div className="flex w-full bg-gray-50 border border-gray-200 rounded-full overflow-hidden focus-within:border-primary focus-within:bg-white transition-all">
// After
<div className="flex w-full bg-gray-50 border border-gray-200 rounded-md overflow-hidden focus-within:border-primary focus-within:bg-white transition-all">
```

```tsx
// Before (mobile)
<div className="flex bg-gray-50 border border-gray-200 rounded-full overflow-hidden">
// After
<div className="flex bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
```

- [ ] **Step 2: 커밋**

```bash
npm run lint
git add src/shared/components/HeaderClient.tsx
git commit -m "design(header): 검색바 모서리 rounded-full → rounded-md"
```

---

## Task 6: 홈 페이지 정리

**Files:**
- Modify: `src/features/home/HomeContent.tsx`
- Modify: `src/app/page.tsx`(컨테이너 max-w 정리)

- [ ] **Step 1: HomeContent 내부 `max-w-[1200px]` → `max-w-[1440px]` 일괄 치환, 카드 rounded-lg → rounded-sm, shadow 제거**

핵심 변경:
- 모든 섹션의 `max-w-[1200px] mx-auto px-4` → `max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8`
- 모든 카드의 `rounded-lg`/`rounded-2xl`(배너) → `rounded-sm`(카드) / `rounded-md`(배너)
- 모든 `hover:shadow-md` 제거, `hover:border-primary/40` 등 보더 강조로 대체
- 카드 안 정보 보강: 등록일/지원자수/마감/지역/업종/고용형태 등 6개 이상 노출
- 모든 광고 배너에 `광고/Marié` 라벨이 이미 'AD' chip으로 있음 — 텍스트 라벨 'Marié 추천' 병기

`HomeContent.tsx` 전체를 Edit. 핵심 패턴은:

```tsx
// 컨테이너
<div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8 py-6">

// 핫 채용 카드
<Link className="border border-gray-200 rounded-sm p-4 hover:border-primary/40 transition-colors group">

// AD 라벨
<span className="badge-promoted">광고</span>
```

전체 파일 Write로 교체 (큰 변경이라 안전).

- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
npm run build
git add src/features/home/HomeContent.tsx
git commit -m "design(home): 컨테이너 1440px, 카드 평면화, AD→광고 라벨"
```

---

## Task 7: 채용 페이지 — 필터/카드/리스트 정비

**Files:**
- Modify: `src/features/jobs/components/JobsPageContent.tsx`
- Modify: `src/features/jobs/components/JobCard.tsx`
- Create: `src/features/jobs/components/JobListRow.tsx` (분리)

- [ ] **Step 1: JobListRow.tsx 신설 (인라인 행을 컴포넌트화)**

```tsx
// src/features/jobs/components/JobListRow.tsx
import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import { getDDayLabel, isUrgent, isNew, getJobTier } from '@/shared/utils/tier';
import Badge from '@/shared/components/Badge';
import ProfileAvatar from '@/shared/components/ProfileAvatar';

interface Props {
  job: Job;
}

export default function JobListRow({ job }: Props) {
  const tier = getJobTier(job);
  const dDay = getDDayLabel(job.deadline);
  const urgent = isUrgent(job.deadline);
  const fresh = isNew(job.created_at);

  return (
    <Link
      href={ROUTES.JOBS_DETAIL(job.id)}
      className={`list-row group ${tier === 2 ? 'bg-primary/[0.015]' : ''}`}
    >
      {/* Thumbnail */}
      {job.image ? (
        <div className="w-10 h-10 rounded-sm overflow-hidden bg-gray-100 flex-shrink-0">
          <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-images/${job.image}`} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <ProfileAvatar
          profileImage={job.author?.profile_image}
          name={job.author?.company_name || job.author?.contact_name || '업체'}
          size="sm"
          className="!rounded-sm"
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          {urgent && <Badge kind="urgent">마감임박</Badge>}
          {fresh && !urgent && <Badge kind="new">NEW</Badge>}
          <h3 className="text-body-lg font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
            {job.title}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-small text-gray-500">
          <span className="font-medium text-gray-700 truncate max-w-[140px] sm:max-w-none">
            {job.author?.company_name ?? '알 수 없음'}
          </span>
          <span className="text-gray-300">·</span>
          <span>{job.author?.region ? getRegionLabel(job.author.region) : ''}</span>
          <span className="text-gray-300">·</span>
          <Badge kind="attr">{getEmploymentTypeLabel(job.employment_type)}</Badge>
          <Badge kind="category">{getBusinessTypeLabel(job.business_type)}</Badge>
        </div>
        {job.salary_info && (
          <p className="text-small text-gray-500 mt-0.5">
            <span className="text-text-muted">급여</span> <span className="font-medium text-text-primary">{job.salary_info}</span>
          </p>
        )}
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-micro text-gray-400">
        <time>{formatRelativeTime(job.created_at)}</time>
        {dDay && (
          <span className={`font-semibold ${urgent ? 'text-state-urgent' : 'text-primary'}`}>
            {dDay}
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: JobCard.tsx 정보 보강(그리드 모드용)**

```tsx
// src/features/jobs/components/JobCard.tsx
import Link from 'next/link';
import type { Job } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import {
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import { getJobTier, isUrgent, isNew, getDDayLabel } from '@/shared/utils/tier';
import Badge from '@/shared/components/Badge';

interface JobCardProps {
  job: Job;
}

export default function JobCard({ job }: JobCardProps) {
  const companyName = job.author?.company_name ?? '알 수 없음';
  const region = job.author?.region ? getRegionLabel(job.author.region) : '';
  const tier = getJobTier(job);
  const tierClass = tier === 2 ? 'card-tier-2' : '';
  const dDay = getDDayLabel(job.deadline);
  const urgent = isUrgent(job.deadline);
  const fresh = isNew(job.created_at);

  return (
    <Link href={ROUTES.JOBS_DETAIL(job.id)} className="block group">
      <article className={`card ${tierClass} h-full flex flex-col gap-2.5 group-hover:border-primary`}>
        {/* Status badges */}
        <div className="flex items-center gap-1 flex-wrap min-h-[18px]">
          {urgent && <Badge kind="urgent">마감임박</Badge>}
          {fresh && !urgent && <Badge kind="new">NEW</Badge>}
          <Badge kind="attr">{getEmploymentTypeLabel(job.employment_type)}</Badge>
          <Badge kind="category">{getBusinessTypeLabel(job.business_type)}</Badge>
        </div>

        <h3 className="text-h4 font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {job.title}
        </h3>

        <div className="flex items-center gap-1.5 text-small text-text-secondary">
          <span className="font-medium truncate">{companyName}</span>
          {region && (
            <>
              <span className="text-border">|</span>
              <span className="truncate">{region}</span>
            </>
          )}
        </div>

        {job.salary_info && (
          <p className="text-small text-text-secondary">
            <span className="text-text-muted">급여</span>{' '}
            <span className="font-medium text-text-primary">{job.salary_info}</span>
          </p>
        )}

        <div className="mt-auto pt-2 border-t border-border flex items-center justify-between text-micro text-text-muted">
          <time dateTime={job.created_at}>{formatRelativeTime(job.created_at)}</time>
          {dDay && (
            <span className={`font-semibold ${urgent ? 'text-state-urgent' : 'text-primary'}`}>
              {dDay}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
```

- [ ] **Step 3: JobsPageContent.tsx 정비 — 칩 rounded 축소, 활성 필터 칩 컴포넌트화, ViewToggle 추가, JobListRow 사용**

핵심 변경:
- 컨테이너 `max-w-[1200px]` → `max-w-[1600px]`
- 비즈니스 타입/지역/고용형태 드롭다운 안의 `rounded-full` → `rounded-sm`
- 활성 필터: 인라인 `<span>` → `<FilterChip label={f.label} onRemove={...} />`
- 페이지 헤더 우상단에 `<ViewToggle />` 추가, 상태는 `useState<ViewMode>('list')`
- list 모드: 기존 인라인 `<Link>` → `<JobListRow />`
- grid 모드: `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">` 안에 `<JobCard />`

전체 Write로 교체.

- [ ] **Step 4: 빌드 + 커밋**

```bash
npm run build
git add src/features/jobs/
git commit -m "design(jobs): ViewToggle + List/Grid 분리, 라벨 시스템 적용, 컨테이너 1600"
```

---

## Task 8: 디렉토리 — 사이드바 필터화

**Files:**
- Modify: `src/app/(main)/directory/page.tsx`
- Modify: `src/features/directory/components/CompanyFilters.tsx` (사이드바 버전으로 전환)
- Modify: `src/features/directory/components/CompanyCard.tsx` (정보 추가)
- Modify: `src/features/directory/components/CompanyList.tsx` (5-col 그리드)

- [ ] **Step 1: CompanyFilters.tsx — 사이드바 형태로 재작성**

```tsx
'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BUSINESS_TYPES, REGIONS } from '@/shared/constants';

export default function CompanyFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const businessType = searchParams.get('businessType') ?? '';
  const region = searchParams.get('region') ?? '';
  const search = searchParams.get('search') ?? '';

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      params.delete('page');
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateParams({ search: ((formData.get('search') as string) ?? '').trim() });
  };

  const resetAll = () => router.push('/directory', { scroll: false });

  return (
    <aside className="bg-white border border-gray-200 rounded-sm divide-y divide-gray-100 sticky-sidebar">
      {/* 검색 */}
      <div className="p-3">
        <form onSubmit={handleSearch}>
          <label className="block text-micro font-semibold text-gray-700 mb-1.5">검색</label>
          <div className="relative">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="업체명·담당자"
              className="input-field pr-8 text-small"
            />
            <button type="submit" aria-label="검색"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* 업종 */}
      <div className="p-3">
        <h3 className="text-micro font-semibold text-gray-700 mb-2">업종</h3>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => updateParams({ businessType: '' })}
            className={`text-left text-small py-1 px-2 rounded-sm transition-colors ${
              !businessType ? 'bg-primary/5 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >전체</button>
          {BUSINESS_TYPES.map((b) => (
            <button
              key={b.value}
              onClick={() => updateParams({ businessType: b.value })}
              className={`text-left text-small py-1 px-2 rounded-sm transition-colors ${
                businessType === b.value ? 'bg-primary/5 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >{b.label}</button>
          ))}
        </div>
      </div>

      {/* 지역 */}
      <div className="p-3">
        <h3 className="text-micro font-semibold text-gray-700 mb-2">지역</h3>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => updateParams({ region: '' })}
            className={`text-left text-small py-1 px-2 rounded-sm transition-colors ${
              !region ? 'bg-primary/5 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >전국</button>
          {REGIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => updateParams({ region: r.value })}
              className={`text-left text-small py-1 px-2 rounded-sm transition-colors ${
                region === r.value ? 'bg-primary/5 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >{r.label}</button>
          ))}
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={resetAll}
          className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 border border-gray-200 rounded-sm hover:border-gray-400 transition-colors"
        >
          필터 초기화
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: directory/page.tsx — 사이드바 + 메인 2-컬럼 레이아웃**

```tsx
import { Suspense } from 'react';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import CompanyFilters from '@/features/directory/components/CompanyFilters';
import CompanyList from '@/features/directory/components/CompanyList';
import type { Profile } from '@/types/database';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '업체 디렉토리 | Marié',
  description: '웨딩 업계 파트너를 찾아보세요. 업종, 지역별로 검색할 수 있습니다.',
};

interface PageProps {
  searchParams: Record<string, string | undefined>;
}

async function getProfiles(searchParams: Record<string, string | undefined>) {
  const supabase = createServerQueryClient();
  const page = Number(searchParams.page) || 1;
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .eq('is_directory_listed', true);

  if (searchParams.businessType) {
    query = query.ilike('business_type', `%${searchParams.businessType}%`);
  }
  if (searchParams.region) {
    query = query.ilike('region', `%${searchParams.region}%`);
  }
  if (searchParams.search) {
    query = query.or(`company_name.ilike.%${searchParams.search}%,contact_name.ilike.%${searchParams.search}%`);
  }

  query = query.order('company_name', { ascending: true }).range(from, to);

  const { data, count } = await query;
  return { profiles: (data ?? []) as Profile[], count: count ?? 0 };
}

export default async function DirectoryPage({ searchParams }: PageProps) {
  const { profiles, count } = await getProfiles(searchParams);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-text-primary">업체 디렉토리</h1>
          <p className="mt-0.5 text-small text-text-secondary">웨딩 업계 파트너를 찾아보세요</p>
        </div>
        <Link href={ROUTES.DIRECTORY_REGISTER} className="btn-primary shrink-0">
          업체 등록
        </Link>
      </div>

      {/* Body — 사이드바 + 메인 */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        <Suspense fallback={<div className="hidden lg:block h-[400px] bg-gray-100 rounded-sm animate-pulse" />}>
          <CompanyFilters />
        </Suspense>
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="card animate-pulse h-48" />
              ))}
            </div>
          }
        >
          <CompanyList initialProfiles={profiles} initialCount={count} />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: CompanyCard.tsx — 정보 보강(7-10개)**

```tsx
import Link from 'next/link';
import type { Profile } from '@/types/database';
import { ROUTES } from '@/shared/constants';
import { getBusinessTypeLabel, getRegionLabel } from '@/shared/utils/format';
import Badge from '@/shared/components/Badge';

interface CompanyCardProps {
  profile: Profile;
}

export default function CompanyCard({ profile }: CompanyCardProps) {
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  const displayName = profile.company_name || profile.contact_name;
  const businessTypes = profile.business_type
    ? profile.business_type.split(',').filter(Boolean).map((s) => s.trim())
    : [];
  const bioText = profile.bio
    ? profile.bio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  return (
    <Link
      href={ROUTES.DIRECTORY_DETAIL(profile.id)}
      className="block bg-white border border-gray-200 rounded-sm overflow-hidden group hover:border-primary transition-colors duration-150"
    >
      <div className="aspect-[2/1] bg-gray-50 overflow-hidden flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} className="w-full h-full object-contain p-3" />
        ) : (
          <span className="font-serif text-3xl text-gray-300 font-bold">M</span>
        )}
      </div>

      <div className="p-3">
        <h3 className="text-body-lg font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1 mb-1.5">
          {displayName}
        </h3>

        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {businessTypes.length > 0 ? (
            <>
              {businessTypes.slice(0, 3).map((bt) => (
                <Badge key={bt} kind="category">{getBusinessTypeLabel(bt)}</Badge>
              ))}
              {businessTypes.length > 3 && (
                <Badge kind="attr">+{businessTypes.length - 3}</Badge>
              )}
            </>
          ) : (
            <Badge kind="attr">미등록</Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-micro text-gray-500 mb-1.5">
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="truncate">{getRegionLabel(profile.region)}</span>
          <span className="text-gray-300">·</span>
          <span className="truncate">{profile.contact_name}</span>
        </div>

        {bioText && (
          <p className="text-small text-gray-500 line-clamp-2 leading-snug">{bioText}</p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: CompanyList.tsx — 5-col 그리드**

```tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import type { Profile } from '@/types/database';
import CompanyCard from './CompanyCard';
import Pagination from '@/shared/components/Pagination';
import EmptyState from '@/shared/components/EmptyState';

const PAGE_SIZE = 20;

interface CompanyListProps {
  initialProfiles?: Profile[];
  initialCount?: number;
}

export default function CompanyList({ initialProfiles, initialCount }: CompanyListProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const profiles = initialProfiles ?? [];
  const totalCount = initialCount ?? 0;
  const currentPage = Number(searchParams.get('page') ?? '1');
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`?${params.toString()}`);
  };

  if (profiles.length === 0) {
    return (
      <EmptyState
        title="등록된 업체가 없습니다"
        description="검색 조건을 변경하거나 필터를 초기화해 보세요."
      />
    );
  }

  return (
    <div>
      <p className="text-small text-gray-500 mb-3" aria-live="polite">
        총 <span className="font-semibold text-gray-900">{totalCount.toLocaleString()}</span>개 업체
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {profiles.map((profile) => (
          <CompanyCard key={profile.id} profile={profile} />
        ))}
      </div>

      <div className="mt-6">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 빌드 + 커밋**

```bash
npm run build
git add src/app/\(main\)/directory/page.tsx src/features/directory/
git commit -m "design(directory): 사이드바 필터, 5-col 그리드, 카드 정보 보강"
```

---

## Task 9: 커뮤니티/이벤트/검색/마이 — 컨테이너·라벨 정합

**Files:**
- Modify: `src/app/(main)/community/page.tsx`
- Modify: `src/app/(main)/events/page.tsx`
- Modify: `src/app/(main)/search/page.tsx`
- Modify: `src/features/community/components/PostFilters.tsx`

- [ ] **Step 1: community/page.tsx — `max-w-3xl` → `max-w-[1200px]`(우측 사이드 옵션 없이 단일 컬럼 유지)**

```tsx
// community/page.tsx 첫 div className 변경
<div className="max-w-[1200px] mx-auto space-y-4">
```

게시글 카테고리 칩 색상은 그대로 두되, PostFilters 검색 입력 `border-gray-300` → `border-gray-200`로 통일, rounded 없음 → `rounded-sm`.

- [ ] **Step 2: events/page.tsx — `max-w-4xl` → `max-w-[1440px]`, EventCard rounded 정리, shadow 제거**

```tsx
<div className="max-w-[1440px] mx-auto space-y-5">
```

EventCard `hover:shadow-md` 제거, `rounded-none` 유지 (이미 평면), 카드 그리드 `sm:grid-cols-2` → `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.

- [ ] **Step 3: search/page.tsx — `max-w-3xl` → `max-w-[1200px]`, 카드 rounded-xl → rounded-sm**

- [ ] **Step 4: 빌드 + 커밋**

```bash
npm run build
git add src/app/\(main\)/community/page.tsx src/app/\(main\)/events/page.tsx src/app/\(main\)/search/page.tsx src/features/community/components/PostFilters.tsx
git commit -m "design(community/events/search): 컨테이너 폭 확장, 카드 평면화"
```

---

## Task 10: 검증 — 빌드, lint, 수동 확인

- [ ] **Step 1: 전체 빌드**

```bash
npm run build
```
Expected: 성공, no warnings/errors

- [ ] **Step 2: lint**

```bash
npm run lint
```
Expected: 통과

- [ ] **Step 3: dev 서버 실행 + 주요 페이지 수동 확인**

```bash
npm run dev
```

확인 항목:
- [ ] `/` 홈 — 카드들이 평면화, 광고 라벨 보임, 컨테이너 1440px
- [ ] `/jobs` — 리스트/그리드 토글 동작, 활성 필터 칩 동작, 마감임박/NEW 라벨 보임
- [ ] `/directory` — 사이드바 필터 데스크탑에서 보임, 5-col 그리드(2xl)
- [ ] `/community` — 컨테이너 확장
- [ ] `/events` — 컨테이너 확장
- [ ] `/search?q=웨딩` — 결과 페이지 컨테이너 확장
- [ ] 모바일 (DevTools) — 카드 풀폭, 검색바 헤더 sticky, 필터 사이드바 → 단일 컬럼으로 떨어짐

- [ ] **Step 4: 최종 확인 후 보고**

---

## 자체 검증 체크

- 모든 step에 placeholder 없음 ✅
- 컴포넌트 간 import 경로 일치 ✅
- Tier 함수 시그니처 일관 (`getJobTier(Pick<Job, ...>)` Task 2와 Task 7에서 동일 사용) ✅
- Badge `kind` 값 6종(urgent/new/promoted/verified/attr/category) 일관 ✅
- spec의 셀프 체크리스트 항목 모두 Task 10에서 검증 ✅
