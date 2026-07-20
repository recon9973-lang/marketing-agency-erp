-- 인사관리평가 — 직원 주기별 다면 평가.
CREATE TABLE IF NOT EXISTS "HrEvaluation" (
  "id" TEXT NOT NULL,
  "evaluateeId" TEXT NOT NULL,
  "evaluatorId" TEXT,
  "period" TEXT NOT NULL,
  "performance" INTEGER NOT NULL DEFAULT 3,
  "collaboration" INTEGER NOT NULL DEFAULT 3,
  "diligence" INTEGER NOT NULL DEFAULT 3,
  "expertise" INTEGER NOT NULL DEFAULT 3,
  "attitude" INTEGER NOT NULL DEFAULT 3,
  "strengths" TEXT,
  "improvements" TEXT,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrEvaluation_evaluateeId_idx" ON "HrEvaluation" ("evaluateeId");
CREATE INDEX IF NOT EXISTS "HrEvaluation_period_idx" ON "HrEvaluation" ("period");
