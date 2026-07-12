-- Client.region(지역) — GEO 질문 생성·로컬 채널에 자동 사용(이중 입력 제거).
-- 안전·멱등: ADD COLUMN IF NOT EXISTS 만.

BEGIN;

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "region" TEXT;

COMMIT;
