-- ContentPlan — 예약발행 리컨실용 컬럼 추가(scheduledAt, wpPostId).
-- 안전·멱등: ADD COLUMN IF NOT EXISTS 만. 기존 데이터 무영향.

BEGIN;

ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "wpPostId" INTEGER;

COMMIT;
