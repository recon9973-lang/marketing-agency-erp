-- PAA(환자 질문) 스냅샷 테이블 — journeymap 확장 (멱등 additive)
BEGIN;
CREATE TABLE IF NOT EXISTS "PaaSnapshot" (
  "id" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "region" TEXT,
  "topic" TEXT,
  "advertiser" TEXT,
  "result" JSONB NOT NULL,
  "rawCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaaSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaaSnapshot_query_createdAt_idx" ON "PaaSnapshot"("query", "createdAt");
COMMIT;
