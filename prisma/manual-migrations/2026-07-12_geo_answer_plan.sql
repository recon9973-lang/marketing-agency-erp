-- GeoQuestion.answerPlanId — 질문 → 자동 생성 답변 페이지(ContentPlan) 링크.
-- 안전·멱등: ADD COLUMN IF NOT EXISTS 만.

BEGIN;

ALTER TABLE "GeoQuestion" ADD COLUMN IF NOT EXISTS "answerPlanId" TEXT;

COMMIT;
