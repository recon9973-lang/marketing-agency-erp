-- 원고 초안(자체 제작) 테이블 — 프로젝트 안에서 직접 쓰거나 AI로 생성한 실제 원고.
CREATE TABLE IF NOT EXISTS "ManuscriptDraft" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL DEFAULT 'BLOG',
  "body" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManuscriptDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ManuscriptDraft_projectId_idx" ON "ManuscriptDraft" ("projectId");
