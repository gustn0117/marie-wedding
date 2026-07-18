# 외부 감사(audits/code-audit-2026-07-18.md) 후속 처리

다른 AI가 찾기 전용으로 생성한 감사 보고서를, 현재 코드·라이브 DB에 대해 **적대적으로 재검증**한 뒤 처리한 결과.

## 재검증 후 즉시 수정 완료 (라이브)

DB 변경이라 배포 없이 즉시 반영됨.

### C1 — 마리에 스토리지 버킷 anon 권한 노출 (치명적, 실재 확인)
라이브 `pg_policies` 로 확인: `verifications`(private, 사업자등록증 PII 117개/255MB)에 public
역할 SELECT/INSERT/UPDATE/DELETE 전부 허용 → 공개 anon 키로 열람·덮어쓰기·삭제 가능.
avatars/job-images/event-images 도 anon 쓰기 + 소유자 검사 없음.
- 앱 업로드는 전부 service_role 서버 라우트이거나 인증 세션 클라 업로드({user_id}/... 경로)임을 확인 → 정상동작 유지하며 잠금 가능.
- **조치**(`20260718000400_...`): verifications 4개 정책 전부 제거(service_role 전용). avatars 쓰기 →
  authenticated + 소유자 경로 스코프. job-images 쓰기 → authenticated. event-images anon 쓰기 제거.
  공개 이미지 읽기(SELECT)는 유지. 공유 인스턴스라 마리에 버킷 정책만 정밀 수정(타 앱 무영향).
- **후속 권장**: verifications 버킷의 orphan PII 117개 파일 자체 삭제(기능 제거됨). 정책 잠금으로 노출은 이미 닫힘.

### C2 — role 기반 관리자 권한 상승 (치명적, 실재하나 잠복)
`is_admin()` 이 `banned_at` 미검사 → 제재된 admin 이 self-unban 가능. `reactivate_profile_clean`
이 `role` 미리셋 → 탈퇴한 admin 재로그인 시 admin 복구. 현재 role='admin' 프로필 0명(관리자는
ADMIN_PW 게이트)이라 잠복.
- **조치**(`20260718000400_...`): is_admin 에 `banned_at IS NULL` 추가. reactivate 에 `role='user'` 리셋 추가.

### bootstrap 마이그레이션 누락 (높음 · DR 불능)
`scripts/bootstrap-database.sh` 의 MIGRATIONS 배열이 `20260715000100` 에서 끝나 7/18 migration
4개 누락 → 신규/재해복구 DB bootstrap 이 미등록 파일에서 중단.
- **조치**: 4개 파일을 배열에 추가.

## 이미 이번 세션에서 처리됨 (외부 감사와 중복)

- 이력서 PII redaction / avatar 삭제 / 문의 삭제: fix(123)(124)에서 이미 처리 → 외부 감사도 "기각 후보"로 인정.
- 민감 profile 컬럼 브라우저 노출: 컬럼 GRANT allowlist 가 방어(외부 감사 기각).
- OTP/signup 워커별 레이트리밋, 메시지 요약/미읽음, 지원자 목록, 스토리지 정리 스케일, 지원 알림 멱등:
  [scalability-roadmap](2026-07-18-scalability-roadmap.md) 에 이미 등재.

## 로드맵 (실재하나 제품/스키마 결정 또는 신중 구현 필요)

1. **정지회원 write 차단**(높음): `send_message`/`start_conversation` 등 RPC 가 `deleted_at` 만 보고
   `banned_at` 미검사 → 제재 계정이 API 직접 호출로 메시지/알림 생성 가능. 메시징 기능은 현재 0행
   미사용. 공통 active-profile 조건에 `banned_at IS NULL` 을 넣는 messaging 하드닝 패스로 일괄 처리 권장.
2. **탈퇴 시 프로필 PII 즉시파기**(높음): purge 가 avatars/gallery/photo/문의는 정리하나 profiles
   본문 PII(phone·address·bio·business_number·verification_document)·audit_log 전체행 사본은 잔존.
   단 purge 는 **자발적 탈퇴와 관리자 밴이 공유**하므로, 밴 계정 기록 보존 vs 탈퇴 즉시파기를
   분리하는 제품 결정 필요(법적 보존 필드 allowlist + audit retention/partition).
3. **비밀번호 재설정 listUsers 20페이지 상한**(높음): auth.users 2만 초과 시 재설정 메일 조용히 누락.
   Auth Admin 페이지네이션 전수탐색 → 인덱스 기반 exact-email 조회 RPC 로 교체(계정 열거 방지 응답 유지).
4. **네이버 가입 saga 보상 부재**(높음): createUser 성공 후 profile INSERT 실패해도 세션 발급 →
   영구 고아. profile INSERT 성공 확인 + 실패 시 Auth 사용자 보상 삭제/멱등 복구.
5. **like_count 경쟁**(높음): 동시 첫 좋아요 시 COUNT 덮어쓰기로 카운트 어긋남 + O(N) 집계.
   원자적 증감 또는 트리거 집계로 전환. 커뮤니티 좋아요 현재 0행.
6. **지역 필터 부분매칭 오류**(중): `region ILIKE '%anyang%'` 가 `danyang` 매칭(osan⊂seosan 등).
   근본 수정은 region 을 CSV→`text[]` 정규화 후 배열 연산. 스키마+데이터+읽기/쓰기 사이트 변경.
7. **급여 단위 혼동**(중): 월/연(만원)과 일/시(원)를 단위 무시하고 숫자 비교 → 시급 공고가 월급 필터에
   오염. salary 필터에 단위 제한 또는 공통단위 정규화 검색값 도입(데이터 이관 포함).

## 결론

외부 감사가 내 감사가 놓친 **실재 치명 2건(스토리지 anon 노출·admin role 상승)** 을 잡아냈고 즉시 봉합했다.
나머지는 실재하나 제품/스키마 결정을 수반하거나 이미 로드맵에 있어, 결정 후 순차 처리한다. 결제 관련 제외.
