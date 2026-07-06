-- 2026-07-06: 계약서(Contract) + 주간 업무보고(WeeklyReport) 도입 — 추가(additive) 마이그레이션.
-- 안전: 새 테이블만 CREATE. 기존 테이블/데이터는 절대 건드리지 않음(삭제·변경 없음).
-- 실행 순서: 이 SQL을 Neon SQL Editor에서 먼저 실행 → 그 다음 코드 배포(이미 배포됐다면 실행만 하면 됨).
-- 멱등: IF NOT EXISTS 이므로 여러 번 실행해도 안전.

BEGIN;

-- 1) 계약서
CREATE TABLE IF NOT EXISTS "Contract" (
  "id"            TEXT NOT NULL,
  "clientId"      TEXT NOT NULL,
  "authorId"      TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "amount"        DECIMAL(12,2),
  "startDate"     TIMESTAMP(3),
  "endDate"       TIMESTAMP(3),
  "status"        TEXT NOT NULL DEFAULT 'DRAFT',
  "signerName"    TEXT,
  "signerTitle"   TEXT,
  "signatureData" TEXT,
  "signedAt"      TIMESTAMP(3),
  "orgId"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Contract_clientId_idx" ON "Contract"("clientId");
CREATE INDEX IF NOT EXISTS "Contract_authorId_idx" ON "Contract"("authorId");
CREATE INDEX IF NOT EXISTS "Contract_status_idx"   ON "Contract"("status");
CREATE INDEX IF NOT EXISTS "Contract_orgId_idx"    ON "Contract"("orgId");

-- 2) 주간 업무보고
CREATE TABLE IF NOT EXISTS "WeeklyReport" (
  "id"           TEXT NOT NULL,
  "authorId"     TEXT NOT NULL,
  "weekStart"    TIMESTAMP(3) NOT NULL,
  "summary"      TEXT NOT NULL,
  "achievements" TEXT,
  "plans"        TEXT,
  "issues"       TEXT,
  "status"       TEXT NOT NULL DEFAULT 'SUBMITTED',
  "orgId"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);
-- 같은 직원의 같은 주 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReport_authorId_weekStart_key" ON "WeeklyReport"("authorId","weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyReport_authorId_idx"  ON "WeeklyReport"("authorId");
CREATE INDEX IF NOT EXISTS "WeeklyReport_weekStart_idx" ON "WeeklyReport"("weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyReport_orgId_idx"     ON "WeeklyReport"("orgId");

COMMIT;
