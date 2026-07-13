-- Keyword — 네이버 6단계용 등급/확장단계/경쟁도 컬럼. 안전·멱등.

BEGIN;

ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "grade" TEXT;
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "stage" TEXT;
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "competition" TEXT;

COMMIT;
