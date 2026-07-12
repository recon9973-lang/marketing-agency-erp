-- SEO/GEO 영업·운영 워크플로우 — 추가(additive) 마이그레이션.
-- Lead(영업 리드/무료진단 내장) + GeoQuestion/GeoAnswerRecord(AI답변 모니터링)
-- + WorkStatus enum에 CLIENT_APPROVAL(병원승인대기) 값 추가.
-- 안전·멱등: CREATE TABLE/INDEX IF NOT EXISTS, ALTER TYPE ... ADD VALUE IF NOT EXISTS 만.
-- 관례에 따라 FK 제약은 생략(조회에 불필요, apply-manual-migrations.mjs가 문장 단위 실행).

BEGIN;

ALTER TYPE "WorkStatus" ADD VALUE IF NOT EXISTS 'CLIENT_APPROVAL';

CREATE TABLE IF NOT EXISTS "Lead" (
  "id"                 TEXT NOT NULL,
  "hospitalName"       TEXT NOT NULL,
  "department"         TEXT,
  "region"             TEXT,
  "source"             TEXT,
  "contactName"        TEXT,
  "contactPhone"       TEXT,
  "contactEmail"       TEXT,
  "websiteUrl"         TEXT,
  "placeUrl"           TEXT,
  "adBudgetEstimate"   DECIMAL(12,2),
  "note"               TEXT,
  "status"             TEXT NOT NULL DEFAULT 'NEW',
  "grade"              TEXT,
  "assigneeId"         TEXT,
  "nextActionAt"       TIMESTAMP(3),
  "consentAt"          TIMESTAMP(3),
  "consentTextVersion" TEXT,
  "auditChecklist"     JSONB,
  "auditScore"         INTEGER,
  "auditNote"          TEXT,
  "lostReason"         TEXT,
  "clientId"           TEXT,
  "orgId"              TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Lead_status_nextActionAt_idx" ON "Lead"("status","nextActionAt");
CREATE INDEX IF NOT EXISTS "Lead_assigneeId_idx" ON "Lead"("assigneeId");
CREATE INDEX IF NOT EXISTS "Lead_clientId_idx" ON "Lead"("clientId");
CREATE INDEX IF NOT EXISTS "Lead_orgId_idx" ON "Lead"("orgId");

CREATE TABLE IF NOT EXISTS "GeoQuestion" (
  "id"            TEXT NOT NULL,
  "clientId"      TEXT NOT NULL,
  "department"    TEXT,
  "question"      TEXT NOT NULL,
  "priority"      INTEGER NOT NULL DEFAULT 3,
  "status"        TEXT NOT NULL DEFAULT 'CANDIDATE',
  "approvedAt"    TIMESTAMP(3),
  "approvedById"  TEXT,
  "targetPageUrl" TEXT,
  "orgId"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GeoQuestion_clientId_status_idx" ON "GeoQuestion"("clientId","status");
CREATE INDEX IF NOT EXISTS "GeoQuestion_orgId_idx" ON "GeoQuestion"("orgId");

CREATE TABLE IF NOT EXISTS "GeoAnswerRecord" (
  "id"                   TEXT NOT NULL,
  "questionId"           TEXT NOT NULL,
  "engine"               TEXT NOT NULL,
  "checkedOn"            DATE NOT NULL,
  "appeared"             BOOLEAN NOT NULL DEFAULT false,
  "cited"                BOOLEAN NOT NULL DEFAULT false,
  "competitorsMentioned" JSONB,
  "snippet"              TEXT,
  "evidenceUrl"          TEXT,
  "memo"                 TEXT,
  "createdById"          TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoAnswerRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GeoAnswerRecord_questionId_engine_checkedOn_key"
  ON "GeoAnswerRecord"("questionId","engine","checkedOn");

CREATE INDEX IF NOT EXISTS "GeoAnswerRecord_questionId_checkedOn_idx"
  ON "GeoAnswerRecord"("questionId","checkedOn");

CREATE INDEX IF NOT EXISTS "GeoAnswerRecord_createdById_idx"
  ON "GeoAnswerRecord"("createdById");

COMMIT;
