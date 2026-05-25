-- 커뮤니티 카테고리 확장 (질문·후기·지역소식·구인팁)
-- 작성일: 2026-05-25
-- ALTER TYPE ADD VALUE는 트랜잭션 밖에서만 동작하므로 각 statement 단독 실행 필요

ALTER TYPE marie_wedding.post_category ADD VALUE IF NOT EXISTS 'qna';
ALTER TYPE marie_wedding.post_category ADD VALUE IF NOT EXISTS 'review';
ALTER TYPE marie_wedding.post_category ADD VALUE IF NOT EXISTS 'local';
ALTER TYPE marie_wedding.post_category ADD VALUE IF NOT EXISTS 'jobtip';
