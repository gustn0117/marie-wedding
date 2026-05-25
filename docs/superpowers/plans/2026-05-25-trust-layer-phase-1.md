# 신뢰 레이어 Phase 1 (업체 인증) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사업자등록증 기반 업체 인증 시스템을 풀스택 구현하고, 디렉토리·공고 카드와 프로필 상세에 "인증" 배지를 노출한다.

**Architecture:** 전체 신뢰 레이어 스키마(profiles 컬럼 + portfolios + reviews + review_tags + applications 컬럼)를 단일 마이그레이션으로 한 번에 적용한다. UI는 Phase 1 범위인 업체 인증 흐름만 구현. 인증 신청은 service_role API 라우트(이미지 업로드 + Storage 저장 + DB 갱신)에서 처리. 어드민 승인/거절도 별도 service_role API. RLS는 본인+admin 패턴 유지. 디자인은 기존 무채색 팔레트와 Density 철학 그대로.

**Tech Stack:** Next.js 14 App Router · Supabase (PostgreSQL · Auth · Storage) · TypeScript · Tailwind CSS

---

## File Structure

**Create:**
- `supabase/migrations/2026-05-25-trust-layer.sql` — 전체 신뢰 레이어 스키마 (Phase 1~4 통합)
- `supabase/migrations/2026-05-25-trust-layer-seed.sql` — review_tags 초기 시드
- `src/features/verification/types.ts` — VerificationStatus, VerificationRequest 타입
- `src/features/verification/services/verificationService.ts` — 클라이언트 쿼리
- `src/features/verification/components/VerificationBadge.tsx` — 카드용 배지
- `src/features/verification/components/VerificationStatusPanel.tsx` — 마이페이지 위젯
- `src/features/verification/components/VerificationForm.tsx` — 신청 폼
- `src/features/admin/components/VerificationAdminTable.tsx` — 어드민 큐
- `src/features/admin/services/adminVerificationService.ts` — 어드민 RPC 호출
- `src/app/(main)/mypage/verification/page.tsx` — 인증 신청 페이지
- `src/app/api/verifications/submit/route.ts` — 인증 신청 API (이미지 업로드 + DB)
- `src/app/api/admin/verifications/decide/route.ts` — 어드민 승인/거절 API
- `src/app/admin/verifications/page.tsx` — 어드민 인증 큐 페이지

**Modify:**
- `src/types/database.ts` — `Profile` 인터페이스에 신규 컬럼 추가, `VerificationStatus`/`Portfolio`/`Review`/`ReviewTag` 타입 추가
- `src/shared/constants.ts` — `VERIFICATION_STATUS_LABELS`, 라우트 상수
- `src/features/directory/components/DirectoryCard.tsx` (or 동등 파일) — 인증 배지 슬롯 추가
- `src/features/jobs/components/JobCard.tsx` (or 동등) — 작성자 인증 배지 표시
- `src/app/(main)/mypage/page.tsx` — `VerificationStatusPanel` 통합
- `src/app/(main)/directory/[id]/page.tsx` — 신뢰 카드 섹션(Phase 1: 인증 상태만)

---

## 주의사항 (모든 task 공통)

- **테스트 인프라 없음**: 본 프로젝트는 jest/vitest가 설치되어 있지 않다. TDD 대신 **Build → Verify → Report** 파이프라인을 적용한다. 각 phase 끝에 `npm run lint`, `npm run build`로 검증.
- **Storage 규칙**: 파일은 모두 Supabase Storage. localStorage는 UI 상태(예: 폼 임시 저장)만.
- **무채색 팔레트**: 배지·버튼·라벨에 새 컬러 토큰 추가 금지. 기존 톤만 활용.
- **service_role 사용**: signup API처럼 RLS를 bypass해야 하는 mutation은 service_role 키를 가진 API 라우트로. 클라이언트에서 직접 mutation 금지.
- **alt 텍스트·접근성**: 모든 이미지 input은 라벨과 hint를 동반.

---

## Task 1: DB 마이그레이션 SQL 작성

**Files:**
- Create: `supabase/migrations/2026-05-25-trust-layer.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 신뢰 레이어 통합 마이그레이션 (Phase 1~4)
-- 작성일: 2026-05-25

-- 1) ENUM 추가
DO $$ BEGIN
  CREATE TYPE marie_wedding.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marie_wedding.review_tag_category AS ENUM ('positive', 'attention');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marie_wedding.review_direction AS ENUM ('hiring_to_applicant', 'applicant_to_hiring');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) profiles 컬럼 추가
ALTER TABLE marie_wedding.profiles
  ADD COLUMN IF NOT EXISTS verification_status marie_wedding.verification_status DEFAULT 'unverified' NOT NULL,
  ADD COLUMN IF NOT EXISTS verification_document TEXT,
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS business_number TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_rate NUMERIC(5,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS avg_response_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS completed_deals_count INTEGER DEFAULT 0 NOT NULL;

-- 3) applications 컬럼 추가
ALTER TABLE marie_wedding.applications
  ADD COLUMN IF NOT EXISTS hiring_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applicant_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMPTZ;

-- 4) portfolios 테이블
CREATE TABLE IF NOT EXISTS marie_wedding.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  event_date DATE,
  role TEXT,
  venue_name TEXT,
  description TEXT,
  images TEXT[] DEFAULT '{}' NOT NULL,
  cover_image TEXT,
  is_featured BOOLEAN DEFAULT FALSE NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portfolios_profile_order
  ON marie_wedding.portfolios(profile_id, display_order)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS portfolios_updated_at ON marie_wedding.portfolios;
CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON marie_wedding.portfolios
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

-- 5) review_tags 테이블
CREATE TABLE IF NOT EXISTS marie_wedding.review_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  category marie_wedding.review_tag_category NOT NULL,
  applies_to TEXT[] NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS review_tags_updated_at ON marie_wedding.review_tags;
CREATE TRIGGER review_tags_updated_at
  BEFORE UPDATE ON marie_wedding.review_tags
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.update_updated_at();

-- 6) reviews 테이블
CREATE TABLE IF NOT EXISTS marie_wedding.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES marie_wedding.applications(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES marie_wedding.profiles(id) ON DELETE CASCADE NOT NULL,
  direction marie_wedding.review_direction NOT NULL,
  tags UUID[] NOT NULL,
  is_public BOOLEAN DEFAULT TRUE NOT NULL,
  is_hidden_by_admin BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_application_direction
  ON marie_wedding.reviews(application_id, direction)
  WHERE deleted_at IS NULL;

-- 7) RLS for new tables
ALTER TABLE marie_wedding.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.review_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE marie_wedding.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portfolios_select ON marie_wedding.portfolios;
CREATE POLICY portfolios_select ON marie_wedding.portfolios
  FOR SELECT USING (deleted_at IS NULL OR marie_wedding.is_admin());

DROP POLICY IF EXISTS portfolios_insert ON marie_wedding.portfolios;
CREATE POLICY portfolios_insert ON marie_wedding.portfolios
  FOR INSERT WITH CHECK (
    profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS portfolios_update ON marie_wedding.portfolios;
CREATE POLICY portfolios_update ON marie_wedding.portfolios
  FOR UPDATE USING (
    profile_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
    OR marie_wedding.is_admin()
  );

DROP POLICY IF EXISTS review_tags_select ON marie_wedding.review_tags;
CREATE POLICY review_tags_select ON marie_wedding.review_tags
  FOR SELECT USING (is_active = TRUE OR marie_wedding.is_admin());

DROP POLICY IF EXISTS review_tags_admin_all ON marie_wedding.review_tags;
CREATE POLICY review_tags_admin_all ON marie_wedding.review_tags
  FOR ALL USING (marie_wedding.is_admin()) WITH CHECK (marie_wedding.is_admin());

DROP POLICY IF EXISTS reviews_select ON marie_wedding.reviews;
CREATE POLICY reviews_select ON marie_wedding.reviews
  FOR SELECT USING (
    (is_public = TRUE AND is_hidden_by_admin = FALSE AND deleted_at IS NULL)
    OR marie_wedding.is_admin()
    OR reviewer_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
    OR reviewee_id IN (SELECT id FROM marie_wedding.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS reviews_admin_update ON marie_wedding.reviews;
CREATE POLICY reviews_admin_update ON marie_wedding.reviews
  FOR UPDATE USING (marie_wedding.is_admin()) WITH CHECK (marie_wedding.is_admin());

-- 8) 트리거: applications status 첫 변경 시 first_responded_at 기록
CREATE OR REPLACE FUNCTION marie_wedding.set_first_responded()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status <> 'pending' AND NEW.first_responded_at IS NULL THEN
    NEW.first_responded_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS applications_first_responded ON marie_wedding.applications;
CREATE TRIGGER applications_first_responded
  BEFORE UPDATE OF status ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.set_first_responded();

-- 9) 트리거: 양쪽 거래 완료 시 completed_deals_count +1 + 알림
CREATE OR REPLACE FUNCTION marie_wedding.notify_deal_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_job marie_wedding.jobs%ROWTYPE;
  v_was_completed BOOLEAN;
  v_is_completed BOOLEAN;
BEGIN
  v_was_completed := OLD.hiring_completed_at IS NOT NULL AND OLD.applicant_completed_at IS NOT NULL;
  v_is_completed := NEW.hiring_completed_at IS NOT NULL AND NEW.applicant_completed_at IS NOT NULL;

  IF NOT v_was_completed AND v_is_completed THEN
    SELECT * INTO v_job FROM marie_wedding.jobs WHERE id = NEW.job_id;

    UPDATE marie_wedding.profiles SET completed_deals_count = completed_deals_count + 1
      WHERE id IN (v_job.author_id, NEW.applicant_id);

    INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
    VALUES
      (v_job.author_id, 'deal_completed', '거래가 완료되었습니다',
       '"' || v_job.title || '" 거래가 양쪽 완료 처리되어 리뷰를 작성할 수 있습니다.',
       '/applications/' || NEW.id || '/review'),
      (NEW.applicant_id, 'deal_completed', '거래가 완료되었습니다',
       '"' || v_job.title || '" 거래가 양쪽 완료 처리되어 리뷰를 작성할 수 있습니다.',
       '/applications/' || NEW.id || '/review');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS applications_deal_completed ON marie_wedding.applications;
CREATE TRIGGER applications_deal_completed
  AFTER UPDATE OF hiring_completed_at, applicant_completed_at ON marie_wedding.applications
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.notify_deal_completed();

-- 10) 인증 상태 변경 시 verified_at 자동 + 알림
CREATE OR REPLACE FUNCTION marie_wedding.notify_verification_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.verification_status <> NEW.verification_status THEN
    IF NEW.verification_status = 'verified' AND NEW.verified_at IS NULL THEN
      NEW.verified_at = NOW();
    END IF;
    IF NEW.verification_status IN ('verified', 'rejected') THEN
      NEW.verification_reviewed_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_verification_status_set_at ON marie_wedding.profiles;
CREATE TRIGGER profiles_verification_status_set_at
  BEFORE UPDATE OF verification_status ON marie_wedding.profiles
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.notify_verification_changed();

CREATE OR REPLACE FUNCTION marie_wedding.notify_verification_result()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_msg TEXT;
BEGIN
  IF OLD.verification_status = NEW.verification_status THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status = 'verified' THEN
    v_title := '업체 인증이 승인되었습니다';
    v_msg := '프로필에 인증 배지가 노출됩니다.';
  ELSIF NEW.verification_status = 'rejected' THEN
    v_title := '업체 인증 신청이 거절되었습니다';
    v_msg := COALESCE('사유: ' || NEW.verification_reject_reason, '관리자에게 문의해 주세요.');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO marie_wedding.notifications(profile_id, type, title, message, link_url)
  VALUES (NEW.id, 'verification_result', v_title, v_msg, '/mypage/verification');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = marie_wedding, public;

DROP TRIGGER IF EXISTS profiles_verification_notify ON marie_wedding.profiles;
CREATE TRIGGER profiles_verification_notify
  AFTER UPDATE OF verification_status ON marie_wedding.profiles
  FOR EACH ROW EXECUTE FUNCTION marie_wedding.notify_verification_result();

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: review_tags 시드 SQL 작성**

Create `supabase/migrations/2026-05-25-trust-layer-seed.sql`:

```sql
INSERT INTO marie_wedding.review_tags (label, category, applies_to, display_order) VALUES
  ('시간 약속을 잘 지킴', 'positive', ARRAY['hiring','applicant'], 10),
  ('소통이 원활함', 'positive', ARRAY['hiring','applicant'], 20),
  ('사전 협의와 실제가 일치함', 'positive', ARRAY['hiring','applicant'], 30),
  ('현장 대응력이 좋음', 'positive', ARRAY['hiring','applicant'], 40),
  ('결제·정산이 깔끔함', 'positive', ARRAY['hiring'], 50),
  ('포트폴리오와 실물이 일치함', 'positive', ARRAY['applicant'], 60),
  ('응답이 늦음', 'attention', ARRAY['hiring','applicant'], 100),
  ('사전 협의와 실제가 불일치함', 'attention', ARRAY['hiring','applicant'], 110),
  ('일방적인 변경·취소', 'attention', ARRAY['hiring','applicant'], 120)
ON CONFLICT (label) DO NOTHING;
```

- [ ] **Step 3: 마이그레이션 검증 (구문만)**

`npx supabase db reset` 또는 호스팅 환경 패널에서 SQL 실행 시 에러 없음을 확인. 본 plan에서는 SQL 파일을 작성하고 사용자가 적용한다. (자체 호스팅이라 자동 실행은 비활성.)

---

## Task 2: TypeScript 타입 보강

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: 신규 타입 + Profile 보강**

`src/types/database.ts` 끝에 추가:

```typescript
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type ReviewTagCategory = 'positive' | 'attention';
export type ReviewDirection = 'hiring_to_applicant' | 'applicant_to_hiring';

export interface ReviewTag {
  id: string;
  label: string;
  category: ReviewTagCategory;
  applies_to: Array<'hiring' | 'applicant'>;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  profile_id: string;
  title: string;
  event_date: string | null;
  role: string | null;
  venue_name: string | null;
  description: string | null;
  images: string[];
  cover_image: string | null;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Review {
  id: string;
  application_id: string;
  reviewer_id: string;
  reviewee_id: string;
  direction: ReviewDirection;
  tags: string[];
  is_public: boolean;
  is_hidden_by_admin: boolean;
  created_at: string;
  deleted_at: string | null;
  reviewer?: Profile;
  resolved_tags?: ReviewTag[];
}
```

기존 `Profile` 인터페이스에 컬럼 추가:

```typescript
export interface Profile {
  // ... 기존 필드 유지
  verification_status: VerificationStatus;
  verification_document: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_reject_reason: string | null;
  business_number: string | null;
  verified_at: string | null;
  phone_verified: boolean;
  phone_verified_at: string | null;
  response_rate: number;
  avg_response_minutes: number | null;
  completed_deals_count: number;
}
```

기존 `Application` 인터페이스에 컬럼 추가:

```typescript
export interface Application {
  // ... 기존 필드 유지
  hiring_completed_at: string | null;
  applicant_completed_at: string | null;
  first_responded_at: string | null;
}
```

---

## Task 3: 상수 추가

**Files:**
- Modify: `src/shared/constants.ts`

- [ ] **Step 1: 라벨 상수 추가**

`src/shared/constants.ts` 끝에 추가:

```typescript
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: '미인증',
  pending: '검토 중',
  verified: '인증 완료',
  rejected: '거절됨',
};

export const VERIFICATION_BADGE_LABEL = '인증';
export const PHONE_VERIFIED_BADGE_LABEL = '실명 확인';
```

`import type { VerificationStatus } from '@/types/database';`를 파일 상단에 추가.

---

## Task 4: feature 모듈 — verification

**Files:**
- Create: `src/features/verification/types.ts`
- Create: `src/features/verification/services/verificationService.ts`

- [ ] **Step 1: types.ts**

```typescript
import type { Profile, VerificationStatus } from '@/types/database';

export interface VerificationSubmitRequest {
  businessNumber: string;
  documentFile: File;
}

export interface VerificationRow extends Pick<Profile,
  'id' | 'contact_name' | 'company_name' | 'business_type' | 'business_number'
  | 'verification_status' | 'verification_document' | 'verification_submitted_at'
  | 'verification_reject_reason'
> {}

export type { VerificationStatus };
```

- [ ] **Step 2: verificationService.ts**

```typescript
'use client';

import { createClient } from '@/lib/supabase/client';
import type { VerificationSubmitRequest } from '@/features/verification/types';

export async function submitVerification(req: VerificationSubmitRequest): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다.' };

  const form = new FormData();
  form.set('businessNumber', req.businessNumber);
  form.set('document', req.documentFile);

  const res = await fetch('/api/verifications/submit', {
    method: 'POST',
    body: form,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text || '요청이 실패했습니다.' };
  }
  return { ok: true };
}
```

---

## Task 5: API 라우트 — 인증 신청

**Files:**
- Create: `src/app/api/verifications/submit/route.ts`

- [ ] **Step 1: route 작성**

`src/app/api/verifications/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHEMA = 'marie_wedding';
const BUCKET = 'verifications';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return new NextResponse('unauthorized', { status: 401 });
  const accessToken = auth.slice('Bearer '.length);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // 1) verify user
  const userSb = createSbClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    db: { schema: SCHEMA },
  });
  const { data: userData, error: userErr } = await userSb.auth.getUser();
  if (userErr || !userData.user) return new NextResponse('unauthorized', { status: 401 });

  const form = await req.formData();
  const businessNumber = (form.get('businessNumber') || '').toString().trim();
  const doc = form.get('document');
  if (!businessNumber || !(doc instanceof File)) {
    return new NextResponse('잘못된 요청입니다.', { status: 400 });
  }
  if (!/^[0-9-]{10,14}$/.test(businessNumber)) {
    return new NextResponse('사업자번호 형식이 올바르지 않습니다.', { status: 400 });
  }
  if (doc.size > 5 * 1024 * 1024) {
    return new NextResponse('파일이 5MB를 초과합니다.', { status: 400 });
  }

  const adminSb = createSbClient(url, serviceKey, { db: { schema: SCHEMA } });

  // 2) find profile
  const { data: profile, error: profErr } = await adminSb
    .from('profiles')
    .select('id, account_type, verification_status')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .single();
  if (profErr || !profile) return new NextResponse('profile not found', { status: 404 });
  if (profile.account_type !== 'business') {
    return new NextResponse('업체 계정만 인증 신청이 가능합니다.', { status: 403 });
  }
  if (profile.verification_status === 'pending') {
    return new NextResponse('이미 검토 중인 신청이 있습니다.', { status: 409 });
  }

  // 3) upload image
  const ext = (doc.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
  const arrayBuf = await doc.arrayBuffer();
  const adminStorage = createSbClient(url, serviceKey);
  const { error: upErr } = await adminStorage.storage.from(BUCKET).upload(path, Buffer.from(arrayBuf), {
    contentType: doc.type || 'image/jpeg',
    upsert: true,
  });
  if (upErr) return new NextResponse('업로드 실패: ' + upErr.message, { status: 500 });

  // 4) update profile
  const { error: updErr } = await adminSb
    .from('profiles')
    .update({
      verification_status: 'pending',
      verification_document: path,
      verification_submitted_at: new Date().toISOString(),
      verification_reject_reason: null,
      business_number: businessNumber,
    })
    .eq('id', profile.id);
  if (updErr) return new NextResponse('업데이트 실패: ' + updErr.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Storage 버킷 안내**

수동 작업: 자체 호스팅 Supabase 콘솔에서 `verifications` 버킷 생성. public=false. 별도 RLS 없이 service_role만 사용.

---

## Task 6: VerificationForm 컴포넌트

**Files:**
- Create: `src/features/verification/components/VerificationForm.tsx`

- [ ] **Step 1: 폼 컴포넌트**

```tsx
'use client';

import { useState } from 'react';
import { submitVerification } from '@/features/verification/services/verificationService';

export default function VerificationForm() {
  const [businessNumber, setBusinessNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('사업자등록증 이미지를 첨부해 주세요.'); return; }
    setBusy(true); setError(null);
    const result = await submitVerification({ businessNumber, documentFile: file });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="border border-black p-6 text-sm">
        <p className="font-semibold">신청이 접수되었습니다.</p>
        <p className="mt-2 text-gray-600">관리자 검토 후 알림으로 결과를 알려드립니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold mb-2">사업자번호</label>
        <input
          type="text"
          value={businessNumber}
          onChange={(e) => setBusinessNumber(e.target.value)}
          placeholder="예) 123-45-67890"
          required
          className="w-full border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">10자리 사업자번호. 입력한 정보와 사업자등록증 이미지가 일치해야 합니다.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">사업자등록증 사본</label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="w-full text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">JPG/PNG/PDF · 5MB 이하. 개인정보는 업로드 전 마스킹을 권장합니다.</p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="px-6 py-2 bg-black text-white text-sm disabled:opacity-50"
      >
        {busy ? '제출 중…' : '인증 신청'}
      </button>
    </form>
  );
}
```

---

## Task 7: 인증 신청 페이지

**Files:**
- Create: `src/app/(main)/mypage/verification/page.tsx`

- [ ] **Step 1: 페이지 작성 (서버 컴포넌트)**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import VerificationForm from '@/features/verification/components/VerificationForm';
import { VERIFICATION_STATUS_LABELS } from '@/shared/constants';
import type { VerificationStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function VerificationPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, account_type, verification_status, verification_submitted_at, verification_reviewed_at, verification_reject_reason, business_number, verified_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (!profile) redirect('/mypage');

  if (profile.account_type !== 'business') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">업체 인증</h1>
        <p className="text-sm text-gray-700">개인 계정은 업체 인증 대상이 아닙니다. 추후 휴대폰 본인인증 기능이 추가될 예정입니다.</p>
      </main>
    );
  }

  const status = profile.verification_status as VerificationStatus;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">업체 인증</h1>
      <p className="text-sm text-gray-600 mb-8">사업자등록증을 제출하면 관리자 검토 후 프로필·카드에 "인증" 배지가 노출됩니다.</p>

      <div className="border border-gray-300 p-4 mb-6 text-sm">
        <p className="font-semibold mb-1">현재 상태: {VERIFICATION_STATUS_LABELS[status]}</p>
        {status === 'verified' && profile.verified_at && (
          <p className="text-gray-600">{new Date(profile.verified_at).toLocaleString('ko-KR')} 승인됨</p>
        )}
        {status === 'pending' && profile.verification_submitted_at && (
          <p className="text-gray-600">{new Date(profile.verification_submitted_at).toLocaleString('ko-KR')} 제출. 검토에는 영업일 기준 1~3일이 소요됩니다.</p>
        )}
        {status === 'rejected' && profile.verification_reject_reason && (
          <p className="text-gray-700">사유: {profile.verification_reject_reason}</p>
        )}
      </div>

      {(status === 'unverified' || status === 'rejected') && <VerificationForm />}
    </main>
  );
}
```

---

## Task 8: 어드민 인증 큐 페이지 + 처리 API

**Files:**
- Create: `src/app/admin/verifications/page.tsx`
- Create: `src/app/api/admin/verifications/decide/route.ts`
- Create: `src/features/admin/components/VerificationAdminTable.tsx`
- Create: `src/features/admin/services/adminVerificationService.ts`

- [ ] **Step 1: 처리 API 라우트**

`src/app/api/admin/verifications/decide/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHEMA = 'marie_wedding';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return new NextResponse('unauthorized', { status: 401 });
  const accessToken = auth.slice('Bearer '.length);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userSb = createSbClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    db: { schema: SCHEMA },
  });
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return new NextResponse('unauthorized', { status: 401 });

  const adminSb = createSbClient(url, serviceKey, { db: { schema: SCHEMA } });
  const { data: caller } = await adminSb
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();
  if (caller?.role !== 'admin') return new NextResponse('forbidden', { status: 403 });

  const body = await req.json().catch(() => null) as { profileId?: string; decision?: 'verified' | 'rejected'; reason?: string } | null;
  if (!body?.profileId || !body.decision) return new NextResponse('잘못된 요청입니다.', { status: 400 });
  if (body.decision === 'rejected' && !body.reason?.trim()) {
    return new NextResponse('거절 사유를 입력해 주세요.', { status: 400 });
  }

  const { error } = await adminSb.from('profiles').update({
    verification_status: body.decision,
    verification_reject_reason: body.decision === 'rejected' ? body.reason : null,
  }).eq('id', body.profileId);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: adminVerificationService.ts**

```typescript
'use client';

import { createClient } from '@/lib/supabase/client';

export async function decideVerification(profileId: string, decision: 'verified' | 'rejected', reason?: string) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false as const, error: '로그인이 필요합니다.' };

  const res = await fetch('/api/admin/verifications/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ profileId, decision, reason }),
  });
  if (!res.ok) return { ok: false as const, error: await res.text() };
  return { ok: true as const };
}

export async function getDocumentSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from('verifications').createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
```

- [ ] **Step 3: VerificationAdminTable 컴포넌트**

```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { decideVerification, getDocumentSignedUrl } from '@/features/admin/services/adminVerificationService';

interface Row {
  id: string;
  contact_name: string;
  company_name: string | null;
  business_type: string | null;
  business_number: string | null;
  verification_document: string | null;
  verification_submitted_at: string | null;
}

export default function VerificationAdminTable({ rows }: { rows: Row[] }) {
  const [items, setItems] = useState(rows);
  const [pending, startTransition] = useTransition();
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    rows.forEach(async (r) => {
      if (r.verification_document) {
        const url = await getDocumentSignedUrl(r.verification_document);
        if (url) setDocUrls((p) => ({ ...p, [r.id]: url }));
      }
    });
  }, [rows]);

  async function handle(id: string, decision: 'verified' | 'rejected') {
    let reason: string | undefined;
    if (decision === 'rejected') {
      const r = prompt('거절 사유를 입력하세요.');
      if (!r?.trim()) return;
      reason = r;
    }
    startTransition(async () => {
      const result = await decideVerification(id, decision, reason);
      if (result.ok) setItems((prev) => prev.filter((x) => x.id !== id));
      else alert(result.error);
    });
  }

  if (items.length === 0) return <p className="text-sm text-gray-600">검토 대기 중인 신청이 없습니다.</p>;

  return (
    <div className="border border-gray-300">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2 border-b border-gray-300">업체명</th>
            <th className="px-3 py-2 border-b border-gray-300">담당자</th>
            <th className="px-3 py-2 border-b border-gray-300">업종</th>
            <th className="px-3 py-2 border-b border-gray-300">사업자번호</th>
            <th className="px-3 py-2 border-b border-gray-300">신청일</th>
            <th className="px-3 py-2 border-b border-gray-300">서류</th>
            <th className="px-3 py-2 border-b border-gray-300">처리</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-b border-gray-200">
              <td className="px-3 py-2">{r.company_name || '-'}</td>
              <td className="px-3 py-2">{r.contact_name}</td>
              <td className="px-3 py-2">{r.business_type || '-'}</td>
              <td className="px-3 py-2 font-mono">{r.business_number || '-'}</td>
              <td className="px-3 py-2">{r.verification_submitted_at ? new Date(r.verification_submitted_at).toLocaleString('ko-KR') : '-'}</td>
              <td className="px-3 py-2">
                {docUrls[r.id] ? (
                  <a href={docUrls[r.id]} target="_blank" rel="noopener" className="underline">보기</a>
                ) : '로딩…'}
              </td>
              <td className="px-3 py-2 space-x-2">
                <button onClick={() => handle(r.id, 'verified')} disabled={pending} className="px-2 py-1 bg-black text-white text-xs">승인</button>
                <button onClick={() => handle(r.id, 'rejected')} disabled={pending} className="px-2 py-1 border border-gray-400 text-xs">거절</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: 어드민 페이지**

`src/app/admin/verifications/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import VerificationAdminTable from '@/features/admin/components/VerificationAdminTable';

export const dynamic = 'force-dynamic';

export default async function AdminVerificationsPage() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from('profiles')
    .select('id, contact_name, company_name, business_type, business_number, verification_document, verification_submitted_at')
    .eq('verification_status', 'pending')
    .is('deleted_at', null)
    .order('verification_submitted_at', { ascending: true });

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">업체 인증 검토</h1>
      <VerificationAdminTable rows={rows ?? []} />
    </main>
  );
}
```

---

## Task 9: VerificationBadge 컴포넌트

**Files:**
- Create: `src/features/verification/components/VerificationBadge.tsx`

- [ ] **Step 1: 배지 컴포넌트**

```tsx
import type { VerificationStatus } from '@/types/database';
import { VERIFICATION_BADGE_LABEL, PHONE_VERIFIED_BADGE_LABEL } from '@/shared/constants';

interface Props {
  verificationStatus: VerificationStatus;
  phoneVerified?: boolean;
  size?: 'sm' | 'md';
}

export default function VerificationBadge({ verificationStatus, phoneVerified, size = 'sm' }: Props) {
  const sizeCls = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  if (verificationStatus === 'verified') {
    return (
      <span className={`inline-flex items-center gap-0.5 border border-black bg-white font-semibold ${sizeCls}`}>
        <span aria-hidden>✓</span>
        {VERIFICATION_BADGE_LABEL}
      </span>
    );
  }

  if (phoneVerified) {
    return (
      <span className={`inline-flex items-center gap-0.5 border border-gray-400 text-gray-700 bg-white ${sizeCls}`}>
        <span aria-hidden>✓</span>
        {PHONE_VERIFIED_BADGE_LABEL}
      </span>
    );
  }

  return null;
}
```

---

## Task 10: 카드에 배지 통합

**Files:**
- Modify: `src/features/directory/components/DirectoryCard.tsx` (or 실제 디렉토리 카드 파일)
- Modify: `src/features/jobs/components/JobCard.tsx` (or 실제 공고 카드 파일)

- [ ] **Step 1: 실제 파일명 확인**

Bash: `ls src/features/directory/components/ src/features/jobs/components/`로 카드 컴포넌트 파일 확인.

- [ ] **Step 2: 디렉토리 카드에 배지 추가**

카드의 제목 영역 옆 또는 우측 상단 라벨 슬롯에 다음 추가:

```tsx
import VerificationBadge from '@/features/verification/components/VerificationBadge';

// JSX 안:
<VerificationBadge
  verificationStatus={profile.verification_status}
  phoneVerified={profile.phone_verified}
/>
```

기존 카드 props가 `Profile` 전체를 전달하지 않으면, `verification_status`와 `phone_verified`를 추가로 select 하고 props에 넣어 준다.

- [ ] **Step 3: 공고 카드에 작성자 배지 추가**

공고 카드는 `author` (Profile join)이 이미 있어야 함. 아니면 services에서 join 추가:

```typescript
.select('*, author:profiles!author_id(*)')
```

JSX에 추가:

```tsx
{job.author && (
  <VerificationBadge
    verificationStatus={job.author.verification_status}
    phoneVerified={job.author.phone_verified}
  />
)}
```

- [ ] **Step 4: 카드 신뢰 메타 한 줄 (선택)**

카드 하단 메타 영역에:

```tsx
{(profile.completed_deals_count > 0 || profile.response_rate > 0) && (
  <p className="text-xs text-gray-600">
    {profile.completed_deals_count > 0 && `거래 ${profile.completed_deals_count}건`}
    {profile.completed_deals_count > 0 && profile.response_rate > 0 && ' · '}
    {profile.response_rate > 0 && `응답률 ${Math.round(profile.response_rate)}%`}
  </p>
)}
```

값이 0이면 표시 안 함 — 초기 사용자 노이즈 방지.

---

## Task 11: 마이페이지 인증 위젯

**Files:**
- Create: `src/features/verification/components/VerificationStatusPanel.tsx`
- Modify: `src/app/(main)/mypage/page.tsx`

- [ ] **Step 1: VerificationStatusPanel 컴포넌트**

```tsx
import Link from 'next/link';
import type { Profile } from '@/types/database';
import { VERIFICATION_STATUS_LABELS } from '@/shared/constants';

export default function VerificationStatusPanel({ profile }: { profile: Pick<Profile, 'account_type' | 'verification_status' | 'phone_verified'> }) {
  const isBusiness = profile.account_type === 'business';
  const label = VERIFICATION_STATUS_LABELS[profile.verification_status];
  const verified = profile.verification_status === 'verified';
  const cta = verified ? '인증 정보 보기' : profile.verification_status === 'pending' ? '검토 상태 보기' : '인증 신청';

  return (
    <section className="border border-gray-300 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">신뢰 상태</h2>
        {isBusiness && (
          <Link href="/mypage/verification" className="text-xs underline">{cta}</Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-600">업체 인증</p>
          <p className="font-semibold">{isBusiness ? label : '해당 없음'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">본인 확인</p>
          <p className="font-semibold">{profile.phone_verified ? '완료' : '미완료'}</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 마이페이지에 통합**

`src/app/(main)/mypage/page.tsx`에서 profile select에 `verification_status, phone_verified` 추가하고, 페이지 상단에 `<VerificationStatusPanel profile={profile} />` 렌더.

---

## Task 12: 프로필 상세에 신뢰 카드 (Phase 1 한정)

**Files:**
- Modify: `src/app/(main)/directory/[id]/page.tsx`

- [ ] **Step 1: select 보강**

해당 페이지의 profiles select에 다음 컬럼 추가:
`verification_status, phone_verified, completed_deals_count, response_rate, avg_response_minutes, verified_at`

- [ ] **Step 2: 신뢰 카드 섹션 추가**

프로필 상세 페이지 상단(헤더 아래)에 4-cell grid:

```tsx
import VerificationBadge from '@/features/verification/components/VerificationBadge';
import { VERIFICATION_STATUS_LABELS } from '@/shared/constants';

// JSX:
<section className="grid grid-cols-2 md:grid-cols-4 gap-2 border border-gray-300 p-4 my-6">
  <div>
    <p className="text-xs text-gray-600 mb-1">인증 상태</p>
    <div className="flex items-center gap-2">
      <p className="text-lg font-bold">{VERIFICATION_STATUS_LABELS[profile.verification_status]}</p>
      <VerificationBadge verificationStatus={profile.verification_status} phoneVerified={profile.phone_verified} />
    </div>
  </div>
  <div>
    <p className="text-xs text-gray-600 mb-1">거래 완료</p>
    <p className="text-lg font-bold">{profile.completed_deals_count}건</p>
  </div>
  <div>
    <p className="text-xs text-gray-600 mb-1">응답률</p>
    <p className="text-lg font-bold">{profile.response_rate > 0 ? `${Math.round(profile.response_rate)}%` : '-'}</p>
  </div>
  <div>
    <p className="text-xs text-gray-600 mb-1">평균 응답</p>
    <p className="text-lg font-bold">{profile.avg_response_minutes ? `${profile.avg_response_minutes}분` : '-'}</p>
  </div>
</section>
```

값이 비어 있으면 `-`로 표시. Phase 2 이전에는 거래 완료·응답률 모두 0/null.

---

## Task 13: Verify + Commit

- [ ] **Step 1: lint**

```bash
npm run lint
```
Expected: 에러 없음. 경고는 OK.

- [ ] **Step 2: build**

```bash
npm run build
```
Expected: 빌드 성공. 타입 에러 없음.

- [ ] **Step 3: 수동 검증 체크리스트**

(개발 서버에서) 다음을 확인:
1. 업체 계정으로 로그인 → `/mypage/verification` 접속 → 폼 노출
2. 사업자번호 + 이미지 제출 → "검토 중" 상태로 전환
3. admin 계정으로 로그인 → `/admin/verifications` → 신청 행 보임 + 서류 링크 동작
4. 승인 → 사용자에게 알림 도착 (`/mypage/notifications`)
5. 디렉토리 카드와 공고 카드에 "인증" 배지 노출
6. 프로필 상세 페이지 4-cell 신뢰 카드 표시

검증 못 한 항목은 보고에 명시.

- [ ] **Step 4: commit**

```bash
git add -A
git commit -m "feat(trust): Phase 1 업체 인증 시스템 구현

- 신뢰 레이어 전체 스키마 마이그레이션 (profiles 컬럼·portfolios·reviews·review_tags·applications 컬럼·트리거·RLS)
- review_tags 초기 시드 9개
- 인증 신청 API + 폼 + 마이페이지 페이지
- 어드민 인증 큐 페이지 + 승인/거절 API
- VerificationBadge 컴포넌트 + 디렉토리·공고 카드 통합
- 프로필 상세 신뢰 카드 4-cell 섹션

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 후속 Phase 요약 (이 plan 범위 외)

- **Phase 2 — 거래 완료 토글**: `applications.hiring_completed_at`/`applicant_completed_at` 양방향 버튼 + completed_deals_count 자동 증가. UI는 공고 상세·마이페이지 신청 관리에 추가.
- **Phase 3 — 포트폴리오**: portfolios CRUD 페이지·폼·갤러리. profile.gallery 이관 후 컬럼 삭제.
- **Phase 4 — 리뷰**: review 작성 폼·프로필 노출·신고 처리. Phase 2 의존.
- **Phase 5 — 개인 휴대폰 본인인증**: SMS 어댑터 + OTP 흐름.

각 phase는 독립 plan 파일로 분리하여 작성.
