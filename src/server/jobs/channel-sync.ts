// 목표 경로: src/server/jobs/channel-sync.ts
//
// 채널 지표 동기화(§13 리포트 소스) — CONNECTED된 구글 연결의 GSC/GA4 지표를
// 최근 30일 일자별로 ChannelMetric에 upsert. 기존 인사이트·월간 리포트가 그대로 소비한다.
//  GSC 노출 → channel "homepage", metric "impressions"
//  GA4 세션 → channel "homepage", metric "visitors"
// 크론 {"job":"sync"}로 하루 1회 실행. 연결별 오류는 해당 연결만 ERROR로 강등(전체 중단 없음).

import { db } from "@/server/db";
import { decryptSecret } from "@/server/crypto";
import { fetchGa4Daily, fetchGa4KeyEvents, fetchGscDaily, fetchGbpDaily, refreshGoogleAccessToken, isGoogleConfigured } from "@/server/integrations/google";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type ChannelSyncResult = { connections: number; synced: number; failed: number; rows: number };

export async function runChannelSync(now = new Date()): Promise<ChannelSyncResult> {
  const result: ChannelSyncResult = { connections: 0, synced: 0, failed: 0, rows: 0 };
  if (!isGoogleConfigured()) return result;

  const connections = await db.channelConnection.findMany({
    where: { provider: "GOOGLE", status: { in: ["CONNECTED", "ERROR"] }, refreshTokenEnc: { not: null } },
    select: { id: true, clientId: true, refreshTokenEnc: true, gscSiteUrl: true, ga4PropertyId: true, gbpLocationId: true, orgId: true }
  });
  result.connections = connections.length;

  // GSC는 최근 2~3일 데이터가 지연 확정되므로 endDate는 2일 전까지.
  const end = new Date(now.getTime() - 2 * 86400000);
  const start = new Date(end.getTime() - 30 * 86400000);
  const startDate = ymd(start);
  const endDate = ymd(end);

  for (const conn of connections) {
    try {
      const refreshToken = decryptSecret(conn.refreshTokenEnc);
      if (!refreshToken) throw new Error("TOKEN_DECRYPT_FAILED");
      const accessToken = await refreshGoogleAccessToken(refreshToken);

      const upserts: Array<{ channel: string; metric: string; date: string; value: number }> = [];
      if (conn.gscSiteUrl) {
        const gsc = await fetchGscDaily(accessToken, conn.gscSiteUrl, startDate, endDate);
        for (const p of gsc.impressions) upserts.push({ channel: "homepage", metric: "impressions", date: p.date, value: p.value });
      }
      if (conn.ga4PropertyId) {
        const ga4 = await fetchGa4Daily(accessToken, conn.ga4PropertyId, startDate, endDate);
        for (const p of ga4) upserts.push({ channel: "homepage", metric: "visitors", date: p.date, value: p.value });
        // 핵심 이벤트(전화/예약/상담 전환) — best-effort(지표명 불일치해도 세션 수집 유지)
        try {
          const ke = await fetchGa4KeyEvents(accessToken, conn.ga4PropertyId, startDate, endDate);
          for (const p of ke) upserts.push({ channel: "homepage", metric: "conversions", date: p.date, value: p.value });
        } catch {
          /* keyEvents 미지원/미설정 — 무시 */
        }
      }
      // GBP 로컬 성과(§13 지도/로컬) → channel "place"
      if (conn.gbpLocationId) {
        const gbp = await fetchGbpDaily(accessToken, conn.gbpLocationId, startDate, endDate);
        for (const p of gbp.impressions) upserts.push({ channel: "place", metric: "impressions", date: p.date, value: p.value });
        for (const p of gbp.interactions) upserts.push({ channel: "place", metric: "interactions", date: p.date, value: p.value });
      }

      for (const u of upserts) {
        const recordedOn = new Date(`${u.date}T00:00:00.000Z`);
        await db.channelMetric.upsert({
          where: {
            clientId_channel_metric_recordedOn: {
              clientId: conn.clientId,
              channel: u.channel,
              metric: u.metric,
              recordedOn
            }
          },
          create: { clientId: conn.clientId, channel: u.channel, metric: u.metric, recordedOn, value: u.value, orgId: conn.orgId },
          update: { value: u.value }
        });
      }
      result.rows += upserts.length;

      await db.channelConnection.update({
        where: { id: conn.id },
        data: { status: "CONNECTED", lastSyncAt: new Date(), lastError: null }
      });
      result.synced++;
    } catch (e) {
      result.failed++;
      await db.channelConnection
        .update({
          where: { id: conn.id },
          data: { status: "ERROR", lastError: String(e).slice(0, 300) }
        })
        .catch(() => undefined);
    }
  }

  return result;
}
