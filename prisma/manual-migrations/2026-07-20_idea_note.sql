-- 아이디어 노트 — 러프 아이디어 → 실행계획서(마크다운).
CREATE TABLE IF NOT EXISTS "IdeaNote" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "clientId" TEXT,
  "title" TEXT NOT NULL,
  "idea" TEXT NOT NULL DEFAULT '',
  "goal" TEXT,
  "audience" TEXT,
  "constraints" TEXT,
  "success" TEXT,
  "plan" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IdeaNote_authorId_idx" ON "IdeaNote" ("authorId");
CREATE INDEX IF NOT EXISTS "IdeaNote_clientId_idx" ON "IdeaNote" ("clientId");
