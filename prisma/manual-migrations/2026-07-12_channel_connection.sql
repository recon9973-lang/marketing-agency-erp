-- ChannelConnection(거래처 채널 API 연결 — GSC/GA4 OAuth 자격증명) — 추가(additive) 마이그레이션.
-- refresh token은 애플리케이션 레이어에서 AES-256-GCM 암호화 후 저장.
-- 안전·멱등: CREATE TABLE/INDEX IF NOT EXISTS 만. FK 생략(관례).

BEGIN;

CREATE TABLE IF NOT EXISTS "ChannelConnection" (
  "id"              TEXT NOT NULL,
  "clientId"        TEXT NOT NULL,
  "provider"        TEXT NOT NULL,
  "refreshTokenEnc" TEXT,
  "gscSiteUrl"      TEXT,
  "ga4PropertyId"   TEXT,
  "status"          TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "lastSyncAt"      TIMESTAMP(3),
  "lastError"       TEXT,
  "connectedById"   TEXT,
  "orgId"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelConnection_clientId_provider_key"
  ON "ChannelConnection"("clientId","provider");

CREATE INDEX IF NOT EXISTS "ChannelConnection_orgId_idx" ON "ChannelConnection"("orgId");

COMMIT;
