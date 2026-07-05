-- P1: Organization(테넌트) 도입 — 추가(additive) 마이그레이션.
-- 안전: 새 테이블/컬럼 추가 + 기존 데이터 백필만. 삭제/변경 없음.
-- 실행 순서: 이 SQL을 Neon에서 먼저 실행 → 그 다음 코드 배포.
-- (prod=erp-v1 코드는 이 컬럼을 모르므로 실행해도 영향 없음.)

BEGIN;

-- 1) Organization 테이블
CREATE TABLE IF NOT EXISTS "Organization" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

-- 2) 기본 조직 1건 (멱등)
INSERT INTO "Organization" ("id","name","slug","createdAt","updatedAt")
VALUES ('org_default','VENOM','venom',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- 3) orgId 컬럼 추가 (nullable)
ALTER TABLE "User"          ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "Client"        ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "WorkItem"      ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "BillingRecord" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "ExpenseRecord" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "Report"        ADD COLUMN IF NOT EXISTS "orgId" TEXT;

-- 4) 기존 데이터 백필 → 기본 조직
UPDATE "User"          SET "orgId"='org_default' WHERE "orgId" IS NULL;
UPDATE "Client"        SET "orgId"='org_default' WHERE "orgId" IS NULL;
UPDATE "WorkItem"      SET "orgId"='org_default' WHERE "orgId" IS NULL;
UPDATE "BillingRecord" SET "orgId"='org_default' WHERE "orgId" IS NULL;
UPDATE "ExpenseRecord" SET "orgId"='org_default' WHERE "orgId" IS NULL;
UPDATE "Report"        SET "orgId"='org_default' WHERE "orgId" IS NULL;

-- 5) FK 제약 (optional 관계 → ON DELETE SET NULL, Prisma 기본과 동일)
ALTER TABLE "User"          ADD CONSTRAINT "User_orgId_fkey"          FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client"        ADD CONSTRAINT "Client_orgId_fkey"        FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkItem"      ADD CONSTRAINT "WorkItem_orgId_fkey"      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report"        ADD CONSTRAINT "Report_orgId_fkey"        FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) 인덱스
CREATE INDEX IF NOT EXISTS "User_orgId_idx"          ON "User"("orgId");
CREATE INDEX IF NOT EXISTS "Client_orgId_idx"        ON "Client"("orgId");
CREATE INDEX IF NOT EXISTS "WorkItem_orgId_idx"      ON "WorkItem"("orgId");
CREATE INDEX IF NOT EXISTS "BillingRecord_orgId_idx" ON "BillingRecord"("orgId");
CREATE INDEX IF NOT EXISTS "ExpenseRecord_orgId_idx" ON "ExpenseRecord"("orgId");
CREATE INDEX IF NOT EXISTS "Report_orgId_idx"        ON "Report"("orgId");

COMMIT;
