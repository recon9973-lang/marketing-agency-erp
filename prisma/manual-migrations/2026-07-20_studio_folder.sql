-- 디자인 스튜디오 폴더 + 프로젝트 폴더 배정.
CREATE TABLE IF NOT EXISTS "StudioFolder" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioFolder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StudioFolder_orgId_idx" ON "StudioFolder" ("orgId");
ALTER TABLE "StudioProject" ADD COLUMN IF NOT EXISTS "folderId" TEXT;
CREATE INDEX IF NOT EXISTS "StudioProject_folderId_idx" ON "StudioProject" ("folderId");
