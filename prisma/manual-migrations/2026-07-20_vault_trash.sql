-- 보관함 휴지통(소프트 삭제). 멱등.
BEGIN;
ALTER TABLE "StoredFile" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "StoredFile_deletedAt_idx" ON "StoredFile" ("deletedAt");
COMMIT;
