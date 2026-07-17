-- MagazinePost — 예약 발행 시각 + 커버 이미지 참조 컬럼 추가.
-- 안전·멱등: ADD COLUMN IF NOT EXISTS 만(추가 전용). 기존 데이터/스키마 무변경.

ALTER TABLE "MagazinePost" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "MagazinePost" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;
