-- 내부 공지사항. 멱등 추가.
BEGIN;
CREATE TABLE IF NOT EXISTS "InternalNotice" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "orgId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalNotice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InternalNotice_createdAt_idx" ON "InternalNotice" ("createdAt");
COMMIT;
