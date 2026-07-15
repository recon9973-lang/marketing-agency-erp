-- 계약서 구조화(details) + 원격 서명 링크(signToken). 멱등 추가.
BEGIN;

ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "details" JSONB;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "signToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_signToken_key" ON "Contract" ("signToken");

COMMIT;
