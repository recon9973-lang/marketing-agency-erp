-- 디자인 스튜디오 브랜드킷 — 조직/거래처별 로고·컬러·폰트.
-- 안전·멱등: CREATE TABLE/INDEX IF NOT EXISTS (재실행 무해).

BEGIN;

CREATE TABLE IF NOT EXISTS "BrandKit" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "clientId"   TEXT,
  "name"       TEXT NOT NULL,
  "colors"     JSONB NOT NULL DEFAULT '[]',
  "logos"      JSONB NOT NULL DEFAULT '[]',
  "fontFamily" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BrandKit_orgId_idx" ON "BrandKit" ("orgId");
CREATE INDEX IF NOT EXISTS "BrandKit_clientId_idx" ON "BrandKit" ("clientId");

COMMIT;
