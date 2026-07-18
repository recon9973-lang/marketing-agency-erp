// 목표 경로: src/server/repositories/insights.ts
//
// 거래처 마케팅 인사이트 — 담당 병원별 채널 방문자·노출 시계열, 검색 순위 추적,
// 핵심/연관 키워드. 마케터는 본인 담당 거래처만, 관리자/최고관리자는 전체.
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type InsightClient = { id: string; name: string };

/** 인사이트를 볼 수 있는 거래처 목록. 마케터는 본인 담당만. */
export async function listInsightClients(user: CurrentUser): Promise<InsightClient[]> {
  const where =
    user.role === Role.MARKETER
      ? { active: true, assignedMarketerId: user.id }
      : { active: true };
  // 방어적: DB 일시 오류에도 화면이 죽지 않도록 빈 목록으로 강등.
  return db.client
    .findMany({ where, orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => []);
}

export type SeriesPoint = { date: string; value: number };
export type ChannelSeries = { channel: string; label: string; total: number; latest: number; points: SeriesPoint[] };
export type RankSeries = { keyword: string; latest: number | null; delta: number | null; points: { date: string; rank: number }[] };
export type KeywordRow = { id: string; keyword: string; channel: string; intent: string | null; searchVolume: number | null; trendRatio: number | null; priority: number };

export type InsightKpis = {
  placeVisitors: number;
  blogVisitors: number;
  homepageVisitors: number;
  totalImpressions: number;
  trackedKeywords: number;
};

export type ClientInsight = {
  clientId: string;
  clientName: string;
  rangeDays: number;
  hasChannelData: boolean;
  hasRankData: boolean;
  kpis: InsightKpis;
  visitorSeries: ChannelSeries[];
  impressionSeries: ChannelSeries[];
  rankSeries: RankSeries[];
  coreKeywords: KeywordRow[];
  relatedKeywords: KeywordRow[];
};

const CHANNEL_LABEL: Record<string, string> = { place: "플레이스", blog: "블로그", homepage: "홈페이지" };
const CHANNEL_ORDER = ["place", "blog", "homepage"];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** channel별로 metric 시계열을 묶는다. 채널 순서는 place→blog→homepage 고정. */
function buildChannelSeries(
  rows: { channel: string; recordedOn: Date; value: number }[]
): ChannelSeries[] {
  const byChannel = new Map<string, SeriesPoint[]>();
  for (const row of rows) {
    const list = byChannel.get(row.channel) ?? [];
    list.push({ date: isoDate(row.recordedOn), value: row.value });
    byChannel.set(row.channel, list);
  }
  const channels = [...byChannel.keys()].sort(
    (a, b) => (CHANNEL_ORDER.indexOf(a) + 1 || 99) - (CHANNEL_ORDER.indexOf(b) + 1 || 99)
  );
  return channels.map((channel) => {
    const points = (byChannel.get(channel) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const total = points.reduce((sum, p) => sum + p.value, 0);
    const latest = points.length ? points[points.length - 1].value : 0;
    return { channel, label: CHANNEL_LABEL[channel] ?? channel, total, latest, points };
  });
}

function latestOf(series: ChannelSeries[], channel: string): number {
  return series.find((s) => s.channel === channel)?.latest ?? 0;
}

/**
 * 단일 거래처 인사이트. clientId가 담당 범위를 벗어나면 null.
 * 채널 지표(ChannelMetric)는 아직 없을 수 있어 hasChannelData로 빈 상태를 구분한다.
 */
export async function getClientInsight(
  user: CurrentUser,
  clientId: string,
  rangeDays = 30
): Promise<ClientInsight | null> {
  const client = await db.client
    .findFirst({
      where:
        user.role === Role.MARKETER
          ? { id: clientId, assignedMarketerId: user.id }
          : { id: clientId },
      select: { id: true, name: true }
    })
    .catch(() => null);
  if (!client) return null;

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (rangeDays - 1));

  // 각 쿼리를 독립적으로 방어(.catch) — 예: ChannelMetric 테이블 미생성 시에도
  // 순위/키워드는 살아있고, 채널 위젯만 빈 상태로 강등되어 화면이 죽지 않는다.
  const [metrics, rankRows, keywords] = await Promise.all([
    db.channelMetric
      .findMany({
        where: { clientId: client.id, recordedOn: { gte: since } },
        orderBy: { recordedOn: "asc" },
        select: { channel: true, metric: true, recordedOn: true, value: true }
      })
      .catch(() => []),
    db.placeRankRecord
      .findMany({
        where: { clientId: client.id, recordedOn: { gte: since } },
        orderBy: { recordedOn: "asc" },
        select: { keyword: true, rank: true, recordedOn: true }
      })
      .catch(() => []),
    db.keyword
      .findMany({
        where: { clientId: client.id },
        orderBy: [{ priority: "asc" }, { searchVolume: "desc" }],
        select: { id: true, keyword: true, channel: true, intent: true, searchVolume: true, trendRatio: true, priority: true }
      })
      .catch(() => [])
  ]);

  const visitorSeries = buildChannelSeries(metrics.filter((m) => m.metric === "visitors"));
  const impressionSeries = buildChannelSeries(metrics.filter((m) => m.metric === "impressions"));

  // 순위 추적 — 키워드별 시계열 + 최신 순위/변동. 순위가 많은(대표) 키워드 상위 6개.
  const rankByKeyword = new Map<string, { date: string; rank: number }[]>();
  for (const row of rankRows) {
    const list = rankByKeyword.get(row.keyword) ?? [];
    list.push({ date: isoDate(row.recordedOn), rank: row.rank });
    rankByKeyword.set(row.keyword, list);
  }
  const rankSeries: RankSeries[] = [...rankByKeyword.entries()]
    .map(([keyword, points]) => {
      const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted.length ? sorted[sorted.length - 1].rank : null;
      const prev = sorted.length > 1 ? sorted[sorted.length - 2].rank : null;
      const delta = latest != null && prev != null ? prev - latest : null; // 양수 = 순위 상승
      return { keyword, latest, delta, points: sorted };
    })
    .sort((a, b) => b.points.length - a.points.length || (a.latest ?? 999) - (b.latest ?? 999))
    .slice(0, 6);

  // 핵심 키워드 = 우선순위 상위(1~2) 또는 검색량이 큰 것. 나머지는 연관 키워드.
  const core: KeywordRow[] = [];
  const related: KeywordRow[] = [];
  for (const k of keywords) {
    const row: KeywordRow = {
      id: k.id,
      keyword: k.keyword,
      channel: k.channel,
      intent: k.intent,
      searchVolume: k.searchVolume,
      trendRatio: k.trendRatio,
      priority: k.priority
    };
    if (core.length < 8 && (k.priority <= 2 || (k.searchVolume ?? 0) >= 1000)) core.push(row);
    else related.push(row);
  }

  const kpis: InsightKpis = {
    placeVisitors: latestOf(visitorSeries, "place"),
    blogVisitors: latestOf(visitorSeries, "blog"),
    homepageVisitors: latestOf(visitorSeries, "homepage"),
    totalImpressions: impressionSeries.reduce((sum, s) => sum + s.latest, 0),
    trackedKeywords: rankSeries.length
  };

  return {
    clientId: client.id,
    clientName: client.name,
    rangeDays,
    hasChannelData: metrics.length > 0,
    hasRankData: rankRows.length > 0,
    kpis,
    visitorSeries,
    impressionSeries,
    rankSeries,
    coreKeywords: core,
    relatedKeywords: related.slice(0, 24)
  };
}
