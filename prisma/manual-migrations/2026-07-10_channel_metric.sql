-- ChannelMetric(거래처 채널 일일 지표) — 추가(additive) 마이그레이션.
-- 안전·멱등: CREATE TABLE/INDEX IF NOT EXISTS 만. 삭제/변경 없음.
-- 목적: prisma db push 가 (연결/드리프트 등으로) 실패해 스킵되더라도
--       인사이트/포털이 참조하는 이 테이블이 반드시 존재하도록 보장한다.
-- apply-manual-migrations.mjs 가 문장 단위로 직접 연결에서 실행(BEGIN/COMMIT은 무시).

BEGIN;

CREATE TABLE IF NOT EXISTS "ChannelMetric" (
  "id"         TEXT NOT NULL,
  "clientId"   TEXT NOT NULL,
  "channel"    TEXT NOT NULL,
  "metric"     TEXT NOT NULL,
  "recordedOn" DATE NOT NULL,
  "value"      INTEGER NOT NULL DEFAULT 0,
  "orgId"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelMetric_clientId_channel_metric_recordedOn_key"
  ON "ChannelMetric"("clientId","channel","metric","recordedOn");

CREATE INDEX IF NOT EXISTS "ChannelMetric_clientId_recordedOn_idx"
  ON "ChannelMetric"("clientId","recordedOn");

CREATE INDEX IF NOT EXISTS "ChannelMetric_orgId_idx"
  ON "ChannelMetric"("orgId");

COMMIT;
