-- ChannelConnection — 권한 생명주기 컬럼(만료/회수) 추가.
-- 안전·멱등: ADD COLUMN IF NOT EXISTS 만. 기존 데이터 무영향.

BEGIN;

ALTER TABLE "ChannelConnection" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "ChannelConnection" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

COMMIT;
