-- 거래처 라이프사이클 단계 컬럼 + 업종 색상 컬럼 보강 (멱등·additive)
-- 빌드 시 prisma db push / sync-additive 가 타임아웃·스킵되어 운영 DB에
-- stage/stageUpdatedAt/colorTag 가 누락되면 listClientsForUser 가 P2022 로 전체 실패,
-- 거래처·의료법검수·회의록·결재·정산 페이지가 동반 다운된다. 이를 방지한다.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "stage" TEXT NOT NULL DEFAULT 'ONBOARDING';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "stageUpdatedAt" TIMESTAMP(3);
ALTER TABLE "IndustryCategory" ADD COLUMN IF NOT EXISTS "colorTag" TEXT;
CREATE INDEX IF NOT EXISTS "Client_stage_idx" ON "Client"("stage");
