-- MagazinePost — 인스타그램 자동 발행 결과 컬럼 추가.
-- 안전·멱등: ADD COLUMN IF NOT EXISTS 만. 기존 데이터 무영향.

BEGIN;

ALTER TABLE "MagazinePost" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;
ALTER TABLE "MagazinePost" ADD COLUMN IF NOT EXISTS "igMediaId" TEXT;
ALTER TABLE "MagazinePost" ADD COLUMN IF NOT EXISTS "igPermalink" TEXT;

COMMIT;
