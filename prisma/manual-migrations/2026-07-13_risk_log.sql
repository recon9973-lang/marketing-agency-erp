-- RiskLog — 리스크 1급 객체(§4/§12/§5-11). 안전·멱등: CREATE TABLE/INDEX IF NOT EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS "RiskLog" (
  "id"         TEXT PRIMARY KEY,
  "clientId"   TEXT,
  "category"   TEXT NOT NULL,
  "severity"   TEXT NOT NULL DEFAULT 'medium',
  "status"     TEXT NOT NULL DEFAULT 'DETECTED',
  "title"      TEXT NOT NULL,
  "detail"     TEXT,
  "sourceType" TEXT,
  "sourceId"   TEXT,
  "score"      INTEGER NOT NULL DEFAULT 0,
  "ownerId"    TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "orgId"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "RiskLog_clientId_sourceType_sourceId_category_key" ON "RiskLog"("clientId", "sourceType", "sourceId", "category");
CREATE INDEX IF NOT EXISTS "RiskLog_status_idx" ON "RiskLog"("status");
CREATE INDEX IF NOT EXISTS "RiskLog_clientId_status_idx" ON "RiskLog"("clientId", "status");
CREATE INDEX IF NOT EXISTS "RiskLog_orgId_idx" ON "RiskLog"("orgId");

COMMIT;
