-- MagazinePost — GROUND 매거진 콘텐츠 트랙(자사 미디어, 의료법·승인 게이트 없음).
-- 안전·멱등: CREATE TABLE / INDEX IF NOT EXISTS 만. FK 없음.

BEGIN;

CREATE TABLE IF NOT EXISTS "MagazinePost" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'glossary',
  "seed" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "draft" TEXT,
  "publishedUrl" TEXT,
  "wpPostId" INTEGER,
  "orgId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MagazinePost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MagazinePost_status_idx" ON "MagazinePost"("status");
CREATE INDEX IF NOT EXISTS "MagazinePost_category_idx" ON "MagazinePost"("category");
CREATE INDEX IF NOT EXISTS "MagazinePost_orgId_idx" ON "MagazinePost"("orgId");

COMMIT;
