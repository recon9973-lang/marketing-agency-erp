-- 인스타 관리 — InstagramAccount(계정) + InstagramPost(발행 큐). 안전·멱등.

BEGIN;

CREATE TABLE IF NOT EXISTS "InstagramAccount" (
  "id"           TEXT PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "handle"       TEXT NOT NULL,
  "igBusinessId" TEXT NOT NULL,
  "tokenRef"     TEXT NOT NULL,
  "graphVersion" TEXT NOT NULL DEFAULT 'v21.0',
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "orgId"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstagramAccount_igBusinessId_key" ON "InstagramAccount"("igBusinessId");
CREATE INDEX IF NOT EXISTS "InstagramAccount_orgId_idx" ON "InstagramAccount"("orgId");

CREATE TABLE IF NOT EXISTS "InstagramPost" (
  "id"          TEXT PRIMARY KEY,
  "accountId"   TEXT NOT NULL,
  "caption"     TEXT NOT NULL,
  "images"      JSONB NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "mediaId"     TEXT,
  "permalink"   TEXT,
  "error"       TEXT,
  "createdById" TEXT,
  "orgId"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstagramPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "InstagramPost_status_scheduledAt_idx" ON "InstagramPost"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "InstagramPost_accountId_idx" ON "InstagramPost"("accountId");
CREATE INDEX IF NOT EXISTS "InstagramPost_orgId_idx" ON "InstagramPost"("orgId");

COMMIT;
