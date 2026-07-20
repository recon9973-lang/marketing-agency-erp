-- GEO 키워드 선택(파이프라인 시작점). 멱등 추가.
BEGIN;

CREATE TABLE IF NOT EXISTS "GeoKeyword" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "volume" INTEGER,
  "source" TEXT NOT NULL DEFAULT 'RELATED',
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "orgId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoKeyword_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GeoKeyword_clientId_term_key" ON "GeoKeyword" ("clientId", "term");
CREATE INDEX IF NOT EXISTS "GeoKeyword_clientId_selected_idx" ON "GeoKeyword" ("clientId", "selected");

COMMIT;
