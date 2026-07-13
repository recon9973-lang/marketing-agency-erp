-- ComplianceLog — 검수 로그 정규화 테이블(§4). 안전·멱등.

BEGIN;

CREATE TABLE IF NOT EXISTS "ComplianceLog" (
  "id"          TEXT PRIMARY KEY,
  "clientId"    TEXT,
  "targetType"  TEXT NOT NULL,
  "targetId"    TEXT NOT NULL,
  "verdict"     TEXT NOT NULL,
  "highCount"   INTEGER NOT NULL DEFAULT 0,
  "mediumCount" INTEGER NOT NULL DEFAULT 0,
  "flags"       JSONB,
  "reviewerId"  TEXT,
  "orgId"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ComplianceLog_targetType_targetId_idx" ON "ComplianceLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "ComplianceLog_clientId_idx" ON "ComplianceLog"("clientId");
CREATE INDEX IF NOT EXISTS "ComplianceLog_orgId_idx" ON "ComplianceLog"("orgId");

COMMIT;
