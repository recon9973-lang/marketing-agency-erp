-- 디자인 스튜디오(이미지 제작툴) — 프로젝트 저장 테이블.
-- 캔버스 문서(페이지·요소)는 해상도 독립 JSON(data)으로 보관한다.
-- 안전·멱등: CREATE TABLE/INDEX IF NOT EXISTS (재실행 무해).

BEGIN;

CREATE TABLE IF NOT EXISTS "StudioProject" (
  "id"        TEXT NOT NULL,
  "orgId"     TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "clientId"  TEXT,
  "title"     TEXT NOT NULL DEFAULT '제목 없는 디자인',
  "kind"      TEXT NOT NULL DEFAULT 'blank',
  "canvasW"   INTEGER NOT NULL,
  "canvasH"   INTEGER NOT NULL,
  "data"      JSONB NOT NULL,
  "thumbnail" TEXT,
  "status"    TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioProject_orgId_updatedAt_idx" ON "StudioProject" ("orgId", "updatedAt");
CREATE INDEX IF NOT EXISTS "StudioProject_ownerId_idx" ON "StudioProject" ("ownerId");
CREATE INDEX IF NOT EXISTS "StudioProject_clientId_idx" ON "StudioProject" ("clientId");

COMMIT;
