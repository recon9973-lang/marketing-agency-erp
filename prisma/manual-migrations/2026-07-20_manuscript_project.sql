-- 원고 스튜디오 거래처별 프로젝트(프롬프트). 멱등 추가.
BEGIN;

CREATE TABLE IF NOT EXISTS "ManuscriptProject" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prompt" TEXT NOT NULL DEFAULT '',
  "notes" TEXT,
  "orgId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManuscriptProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ManuscriptProject_clientId_idx" ON "ManuscriptProject" ("clientId");

COMMIT;
