// 목표 경로: src/server/repositories/client-portal.ts
//
// 거래처 포털 공개 조회 — portalToken으로만 접근. 화이트리스트 필드만 노출(내부 데이터 차단).
import { db } from "@/server/db";

export type PortalReport = { id: string; title: string; month: string; summary: string; keywordRanks: { keyword: string; rank: number | null }[] };
export type PortalPlan = { id: string; month: string; topic: string; angle: string | null; faq: string[]; qa: { q: string; a: string }[] };
export type PortalChannel = { channel: string; label: string; latest: number; delta7: number; points: number[] };
export type PortalRank = { keyword: string; latest: number | null; delta: number | null };
export type PortalPerformance = { rangeDays: number; channels: PortalChannel[]; ranks: PortalRank[] };
export type ClientPortal = {
  clientName: string;
  reports: PortalReport[];
  reviewPlans: PortalPlan[];
  performance: PortalPerformance;
} | null;

const monthFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const PORTAL_CHANNEL_LABEL: Record<string, string> = { place: "플레이스", blog: "블로그", homepage: "홈페이지" };
const PORTAL_CHANNEL_ORDER = ["place", "blog", "homepage"];
const PORTAL_RANGE_DAYS = 30;

/** 포털용 성과 요약(공개) — 채널 방문자 추이 + 검색 순위. 화이트리스트 지표만. */
async function getPortalPerformance(clientId: string): Promise<PortalPerformance> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (PORTAL_RANGE_DAYS - 1));

  const [metrics, rankRows] = await Promise.all([
    db.channelMetric.findMany({
      where: { clientId, metric: "visitors", recordedOn: { gte: since } },
      orderBy: { recordedOn: "asc" },
      select: { channel: true, value: true, recordedOn: true }
    }),
    db.placeRankRecord.findMany({
      where: { clientId, recordedOn: { gte: since } },
      orderBy: { recordedOn: "asc" },
      select: { keyword: true, rank: true, recordedOn: true }
    })
  ]);

  const byChannel = new Map<string, number[]>();
  for (const m of metrics) {
    const list = byChannel.get(m.channel) ?? [];
    list.push(m.value);
    byChannel.set(m.channel, list);
  }
  const channels: PortalChannel[] = [...byChannel.keys()]
    .sort((a, b) => (PORTAL_CHANNEL_ORDER.indexOf(a) + 1 || 99) - (PORTAL_CHANNEL_ORDER.indexOf(b) + 1 || 99))
    .map((channel) => {
      const points = byChannel.get(channel) ?? [];
      const latest = points.length ? points[points.length - 1] : 0;
      const weekAgo = points.length > 7 ? points[points.length - 8] : points[0] ?? 0;
      return { channel, label: PORTAL_CHANNEL_LABEL[channel] ?? channel, latest, delta7: latest - weekAgo, points };
    });

  const byKeyword = new Map<string, number[]>();
  for (const r of rankRows) {
    const list = byKeyword.get(r.keyword) ?? [];
    list.push(r.rank);
    byKeyword.set(r.keyword, list);
  }
  const ranks: PortalRank[] = [...byKeyword.entries()]
    .map(([keyword, ranksArr]) => {
      const latest = ranksArr.length ? ranksArr[ranksArr.length - 1] : null;
      const prev = ranksArr.length > 1 ? ranksArr[ranksArr.length - 2] : null;
      const delta = latest != null && prev != null ? prev - latest : null; // 양수 = 상승
      return { keyword, latest, delta };
    })
    .sort((a, b) => (a.latest ?? 999) - (b.latest ?? 999))
    .slice(0, 6);

  return { rangeDays: PORTAL_RANGE_DAYS, channels, ranks };
}

export async function getClientPortal(token: string): Promise<ClientPortal> {
  const client = await db.client.findUnique({ where: { portalToken: token }, select: { id: true, name: true } });
  if (!client) return null;

  const [reports, plans, performance] = await Promise.all([
    db.report.findMany({
      where: { clientId: client.id, status: { in: ["APPROVED", "DELIVERED"] } },
      orderBy: { reportingMonth: "desc" },
      take: 24,
      select: { id: true, title: true, reportingMonth: true, metrics: true }
    }),
    db.contentPlan.findMany({
      where: { clientId: client.id, status: "REVIEWED" },
      orderBy: { createdAt: "desc" },
      // 화이트리스트: complianceRisk 등 내부 필드 제외.
      select: { id: true, month: true, topic: true, angle: true, faq: true, qa: true }
    }),
    getPortalPerformance(client.id)
  ]);

  return {
    clientName: client.name,
    performance,
    reports: reports.map((r) => {
      const m = (r.metrics as Record<string, unknown> | null) ?? {};
      const ranks = Array.isArray((m as { keywordRanks?: unknown }).keywordRanks)
        ? ((m as { keywordRanks: { keyword: string; rank: number | null }[] }).keywordRanks)
        : [];
      return { id: r.id, title: r.title, month: monthFmt.format(r.reportingMonth), summary: String((m as { summary?: string }).summary ?? ""), keywordRanks: ranks };
    }),
    reviewPlans: plans.map((p) => ({
      id: p.id,
      month: p.month,
      topic: p.topic,
      angle: p.angle,
      faq: Array.isArray(p.faq) ? (p.faq as unknown as string[]) : [],
      qa: Array.isArray(p.qa) ? (p.qa as unknown as { q: string; a: string }[]) : []
    }))
  };
}
