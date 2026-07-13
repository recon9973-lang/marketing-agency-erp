-- Client — 운영 생명주기 상태(§12) 컬럼 추가.
-- 안전·멱등: ADD COLUMN IF NOT EXISTS + 기본값. 기존 행은 ONBOARDING으로 채워짐.

BEGIN;

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'ONBOARDING';

COMMIT;
