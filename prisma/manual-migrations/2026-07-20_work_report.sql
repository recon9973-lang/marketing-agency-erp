-- 업무 보고(작업 결과물) — 담당자가 당일 결과물 링크를 거래처별로 남긴다.
CREATE TABLE IF NOT EXISTS "WorkReport" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "link" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkReport_clientId_idx" ON "WorkReport" ("clientId");
CREATE INDEX IF NOT EXISTS "WorkReport_authorId_idx" ON "WorkReport" ("authorId");
CREATE INDEX IF NOT EXISTS "WorkReport_workDate_idx" ON "WorkReport" ("workDate");
