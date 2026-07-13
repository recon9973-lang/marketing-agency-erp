-- 디자인 스튜디오 업로드 에셋 — 이미지 픽셀을 프로젝트 JSON 밖으로 분리.
-- 백엔드: S3(설정 시) 또는 StoredFile(DB) 폴백. 에디터는 /api/studio/assets/{id} 참조.
-- 안전·멱등: CREATE TABLE/INDEX IF NOT EXISTS (재실행 무해).

BEGIN;

CREATE TABLE IF NOT EXISTS "UploadedAsset" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "ownerId"    TEXT NOT NULL,
  "backend"    TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType"   TEXT NOT NULL,
  "width"      INTEGER,
  "height"     INTEGER,
  "size"       INTEGER NOT NULL,
  "kind"       TEXT NOT NULL DEFAULT 'image',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadedAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UploadedAsset_orgId_createdAt_idx" ON "UploadedAsset" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "UploadedAsset_ownerId_idx" ON "UploadedAsset" ("ownerId");

COMMIT;
