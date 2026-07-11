-- 기능 스키마 보장(멱등·비파괴) — 대시보드 컨펌/인사이트/포털이 참조하는
-- 테이블·컬럼이 프로덕션 DB에 반드시 존재하도록 한다.
--
-- 배경: 이 테이블들(ContentPlan/ClientFeedback/Keyword/PlaceRankRecord)과
--   ContentPlan.clientConfirmedAt/clientComment 컬럼은 수동 마이그레이션에 없었고,
--   불안정한 `prisma db push`(빌드에서 `|| echo`로 실패가 삼켜짐)에만 의존했다.
--   컬럼/테이블 누락 시 인증 화면 데이터 조회가 500을 냈다. 이를 근본 차단한다.
--
-- 원칙: CREATE TABLE / ADD COLUMN / CREATE INDEX 전부 IF NOT EXISTS.
--   이미 있으면 no-op, 없으면 생성. FK 제약은 조회에 불필요하므로 생략(안전·멱등).
--   apply-manual-migrations.mjs 가 문장 단위로 직접 연결에서 실행(BEGIN/COMMIT 무시).

BEGIN;

-- 1) ContentPlan (콘텐츠 기획 + 거래처 컨펌 상태)
CREATE TABLE IF NOT EXISTS "ContentPlan" (
  "id"                TEXT NOT NULL,
  "clientId"          TEXT NOT NULL,
  "month"             TEXT NOT NULL,
  "keyword"           TEXT,
  "topic"             TEXT NOT NULL,
  "angle"             TEXT,
  "faq"               JSONB,
  "qa"                JSONB,
  "draft"             TEXT,
  "complianceRisk"    JSONB,
  "status"            TEXT NOT NULL DEFAULT 'PLANNED',
  "clientConfirmedAt" TIMESTAMP(3),
  "clientComment"     TEXT,
  "orgId"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentPlan_pkey" PRIMARY KEY ("id")
);
-- 테이블이 이미 있으나 신규 컬럼이 빠진 경우 보강(멱등)
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "keyword" TEXT;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "angle" TEXT;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "faq" JSONB;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "qa" JSONB;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "draft" TEXT;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "complianceRisk" JSONB;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "clientConfirmedAt" TIMESTAMP(3);
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "clientComment" TEXT;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ContentPlan" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "ContentPlan_clientId_month_idx" ON "ContentPlan"("clientId", "month");
CREATE INDEX IF NOT EXISTS "ContentPlan_status_idx" ON "ContentPlan"("status");
CREATE INDEX IF NOT EXISTS "ContentPlan_orgId_idx" ON "ContentPlan"("orgId");

-- 2) ClientFeedback (거래처 피드백/컨펌 응답)
CREATE TABLE IF NOT EXISTS "ClientFeedback" (
  "id"        TEXT NOT NULL,
  "clientId"  TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "kind"      TEXT NOT NULL DEFAULT 'GENERAL',
  "orgId"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientFeedback_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ClientFeedback" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "ClientFeedback" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
CREATE INDEX IF NOT EXISTS "ClientFeedback_clientId_createdAt_idx" ON "ClientFeedback"("clientId", "createdAt");

-- 3) Keyword (핵심/연관 키워드 — 인사이트)
CREATE TABLE IF NOT EXISTS "Keyword" (
  "id"           TEXT NOT NULL,
  "clientId"     TEXT NOT NULL,
  "keyword"      TEXT NOT NULL,
  "intent"       TEXT,
  "searchVolume" INTEGER,
  "trendRatio"   DOUBLE PRECISION,
  "priority"     INTEGER NOT NULL DEFAULT 3,
  "channel"      TEXT NOT NULL DEFAULT 'blog',
  "orgId"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "intent" TEXT;
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "searchVolume" INTEGER;
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "trendRatio" DOUBLE PRECISION;
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'blog';
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
CREATE INDEX IF NOT EXISTS "Keyword_clientId_priority_idx" ON "Keyword"("clientId", "priority");
CREATE INDEX IF NOT EXISTS "Keyword_orgId_idx" ON "Keyword"("orgId");

-- 4) PlaceRankRecord (검색 순위 추적 — 인사이트/포털)
CREATE TABLE IF NOT EXISTS "PlaceRankRecord" (
  "id"          TEXT NOT NULL,
  "clientId"    TEXT NOT NULL,
  "keyword"     TEXT NOT NULL,
  "rank"        INTEGER NOT NULL,
  "recordedOn"  DATE NOT NULL,
  "memo"        TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceRankRecord_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PlaceRankRecord" ADD COLUMN IF NOT EXISTS "memo" TEXT;
ALTER TABLE "PlaceRankRecord" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "PlaceRankRecord" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "PlaceRankRecord_clientId_keyword_recordedOn_key" ON "PlaceRankRecord"("clientId", "keyword", "recordedOn");
CREATE INDEX IF NOT EXISTS "PlaceRankRecord_clientId_recordedOn_idx" ON "PlaceRankRecord"("clientId", "recordedOn");
CREATE INDEX IF NOT EXISTS "PlaceRankRecord_createdById_idx" ON "PlaceRankRecord"("createdById");

COMMIT;
