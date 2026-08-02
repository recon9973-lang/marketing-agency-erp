-- 여정맵 프로젝트 서버 저장 (멱등 additive)
BEGIN;
CREATE TABLE IF NOT EXISTS "JourneymapProject" (
  "id" TEXT NOT NULL,
  "mainKeyword" TEXT NOT NULL,
  "hospital" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JourneymapProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JourneymapProject_updatedAt_idx" ON "JourneymapProject"("updatedAt");
COMMIT;
