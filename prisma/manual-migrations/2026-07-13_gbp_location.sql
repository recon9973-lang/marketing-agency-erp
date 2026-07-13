-- ChannelConnection — GBP 로컬 성과 위치 ID 컬럼 추가. 안전·멱등.

BEGIN;

ALTER TABLE "ChannelConnection" ADD COLUMN IF NOT EXISTS "gbpLocationId" TEXT;

COMMIT;
