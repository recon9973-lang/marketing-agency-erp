-- SEO/GEO 전수 검수 반영 — 추가(additive) 마이그레이션.
-- 1) Quote: 리드 단계 견적(leadId) + 미보장 고지 노트(note), clientId를 선택으로 완화(제안 전 게이트)
-- 2) GeoQuestion.qtype: SOP 5유형 영속화
-- 3) ContentPlan.publishedUrl: 게시 증빙 URL
-- 안전·멱등: ADD COLUMN IF NOT EXISTS / DROP NOT NULL(재실행 무해) / CREATE INDEX IF NOT EXISTS.

BEGIN;

ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Quote" ALTER COLUMN "clientId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "Quote_leadId_idx" ON "Quote"("leadId");

ALTER TABLE "GeoQuestion" ADD COLUMN IF NOT EXISTS "qtype" TEXT;

ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "publishedUrl" TEXT;

COMMIT;
