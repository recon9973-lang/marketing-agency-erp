-- ERP SEO 체크 툴 → VENOM 엔진 파이프라인 배선. 리드 무료진단에 엔진 실측 결과를 저장.
-- 기존 수동 체크리스트(auditChecklist/auditScore/auditNote)는 유지하고, 엔진 진단 결과를
-- 별도 컬럼(auditResult/auditEngineVersion/auditRunAt)으로 추가한다.
-- 안전·멱등: ADD COLUMN IF NOT EXISTS (재실행 무해).

BEGIN;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "auditResult" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "auditEngineVersion" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "auditRunAt" TIMESTAMP(3);

COMMIT;
