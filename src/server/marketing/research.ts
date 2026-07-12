// src/server/marketing/research.ts
//
// S2 · 리서치·성과수집 서비스.
// naver provider(providers/naver.ts)를 사용해:
//   1) 키워드 리서치 스냅샷(트렌드 + 경쟁강도)
//   2) 보고서 성과수집(키워드 노출순위 + 경쟁강도) → 기존 Report.metrics(Json)에 병합
//   3) 월간 배치(runMonthlyPerformanceCollection)
//
// 설계 메모(plan-research 3단계 채택안 B):
//   - 기존 keyword-rank.ts를 수정하지 않고 별도 서비스로 추가(무회귀).
//   - 신규 Prisma 모델(KeywordResearch 등)은 아직 미마이그레이션이므로,
//     성과 적재는 이미 존재하는 Report.metrics 만 사용해 지금도 end-to-end 동작.
//   - 네이버 키 미설정 시 provider가 CONFIG_MISSING 반환 → 배치가 죽지 않음.

import { db } from "@/server/db";
import { naverResearch } from "./providers/naver";

// ─────────────────────────────────────────────
// 1) 키워드 리서치 스냅샷
// ─────────────────────────────────────────────

export type KeywordResearchSnapshot = {
  seedKeyword: string;
  trend: { keyword: string; series: { period: string; ratio: number }[] }[] | null;
  competition: { keyword: string; totalDocs: number | null }[];
  collectedAt: string;
  source: string;
  warnings: string[];
};

/**
 * 시드 키워드(+연관어)의 검색 트렌드와 경쟁강도를 수집한다.
 * 반환 데이터는 KeywordResearch 모델 마이그레이션 후 그대로 저장 가능한 형태.
 */
export async function collectKeywordResearch(input: {
  seedKeyword: string;
  related?: string[];
}): Promise<KeywordResearchSnapshot> {
  const keywords = [input.seedKeyword, ...(input.related ?? [])].filter(Boolean);
  const warnings: string[] = [];

  const trendRes = await naverResearch.keywordTrend({ keywords });
  if (!trendRes.ok) warnings.push(`trend:${trendRes.error.code}`);

  const competition: { keyword: string; totalDocs: number | null }[] = [];
  for (const kw of keywords) {
    const c = await naverResearch.keywordCompetition(kw);
    if (c.ok) competition.push({ keyword: kw, totalDocs: c.data.totalDocs });
    else {
      competition.push({ keyword: kw, totalDocs: null });
      warnings.push(`competition:${kw}:${c.error.code}`);
    }
  }

  return {
    seedKeyword: input.seedKeyword,
    trend: trendRes.ok ? trendRes.data : null,
    competition,
    collectedAt: new Date().toISOString(),
    source: "naver",
    warnings,
  };
}

// ─────────────────────────────────────────────
// 2) 보고서 성과수집 → Report.metrics 병합
// ─────────────────────────────────────────────

export type PerformanceSnapshot = {
  keywordRanks: { keyword: string; rank: number | null; checkedAt: string }[];
  competition: { keyword: string; totalDocs: number | null }[];
  target: string;
  channel: "blog" | "web" | "local";
  collectedAt: string;
  source: string;
};

export type CollectResult = { ok: boolean; collected: number; error?: string; warnings?: string[] };

/**
 * 특정 보고서에 대해 대상(target)의 키워드 노출순위·경쟁강도를 수집하고
 * Report.metrics.performance / metrics.keywordRanks 에 병합한다(수기 지표 보존).
 */
export async function collectPerformanceForReport(params: {
  reportId: string;
  keywords: string[];
  target: string;
  channel?: "blog" | "web" | "local";
}): Promise<CollectResult> {
  if (!params.keywords.length) return { ok: false, collected: 0, error: "INVALID_INPUT" };

  const report = await db.report.findUnique({ where: { id: params.reportId } });
  if (!report) return { ok: false, collected: 0, error: "NOT_FOUND" };

  const channel = params.channel ?? "blog";
  const ranksRes = await naverResearch.rankCheck({ keywords: params.keywords, target: params.target, channel });
  if (!ranksRes.ok) return { ok: false, collected: 0, error: ranksRes.error.code };

  const warnings: string[] = [];
  const competition: { keyword: string; totalDocs: number | null }[] = [];
  for (const kw of params.keywords) {
    const c = await naverResearch.keywordCompetition(kw);
    if (c.ok) competition.push({ keyword: kw, totalDocs: c.data.totalDocs });
    else {
      competition.push({ keyword: kw, totalDocs: null });
      warnings.push(`competition:${kw}:${c.error.code}`);
    }
  }

  const snapshot: PerformanceSnapshot = {
    keywordRanks: ranksRes.data,
    competition,
    target: params.target,
    channel,
    collectedAt: new Date().toISOString(),
    source: "naver",
  };

  const prev = (report.metrics as Record<string, unknown> | null) ?? {};
  const merged = {
    ...prev,
    performance: snapshot,
    // keyword-rank.ts와 호환되는 키도 함께 유지
    keywordRanks: ranksRes.data,
    keywordRanksCollectedAt: snapshot.collectedAt,
  };

  await db.report.update({ where: { id: params.reportId }, data: { metrics: merged as never } });
  return { ok: true, collected: ranksRes.data.length, warnings };
}

// ─────────────────────────────────────────────
// 3) 월간 배치
// ─────────────────────────────────────────────

/**
 * reportingMonth의 DRAFT/REVIEW_NEEDED 보고서에 대해 거래처별 설정으로 성과수집.
 * 거래처별 키워드/대상은 호출부(설정·ClientAccount)에서 주입한다.
 * 크론(api/marketing/cron) 또는 서버 액션에서 호출.
 */
export async function runMonthlyPerformanceCollection(
  reportingMonth: Date | string,
  configByClient: Record<string, { keywords: string[]; target: string; channel?: "blog" | "web" | "local" }>,
): Promise<{ reports: number; totalRanks: number }> {
  const reports = await db.report.findMany({
    where: { reportingMonth: reportingMonth as never, status: { in: ["DRAFT", "REVIEW_NEEDED"] } },
    select: { id: true, clientId: true },
  });

  let totalRanks = 0;
  for (const r of reports) {
    const cfg = configByClient[r.clientId];
    if (!cfg?.keywords?.length || !cfg.target) continue;
    const res = await collectPerformanceForReport({ reportId: r.id, ...cfg });
    if (res.ok) totalRanks += res.collected;
  }
  return { reports: reports.length, totalRanks };
}

/** GSC 사이트 URL(sc-domain: 또는 https://…) → 순위 매칭용 호스트. */
export function hostFromGscSiteUrl(gsc: string): string | null {
  let s = gsc.trim().replace(/^sc-domain:/i, "");
  try {
    if (/^https?:\/\//i.test(s)) s = new URL(s).host;
  } catch {
    /* noop */
  }
  s = s.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();
  return s || null;
}

/**
 * 월간 성과수집 설정을 DB에서 자동 구성한다(수기 주입 없이 무인 실행용).
 *  - 대상 거래처: 해당 월에 DRAFT/REVIEW_NEEDED 보고서가 있는 거래처
 *  - keywords: Keyword(우선순위 asc) 상위 maxKeywords개
 *  - target: GOOGLE ChannelConnection의 gscSiteUrl 호스트(없으면 제외 → 수집 스킵)
 */
export async function buildMonthlyPerfConfig(
  reportingMonth: Date | string,
  maxKeywords = 10,
): Promise<Record<string, { keywords: string[]; target: string; channel?: "blog" | "web" | "local" }>> {
  const reports = await db.report.findMany({
    where: { reportingMonth: reportingMonth as never, status: { in: ["DRAFT", "REVIEW_NEEDED"] } },
    select: { clientId: true },
  });
  const clientIds = [...new Set(reports.map((r) => r.clientId))];
  const config: Record<string, { keywords: string[]; target: string; channel?: "blog" | "web" | "local" }> = {};

  for (const clientId of clientIds) {
    const [keywords, conn] = await Promise.all([
      db.keyword.findMany({
        where: { clientId },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        take: maxKeywords,
        select: { keyword: true },
      }),
      db.channelConnection.findFirst({
        where: { clientId, provider: "GOOGLE", gscSiteUrl: { not: null } },
        select: { gscSiteUrl: true },
      }),
    ]);
    const kws = keywords.map((k) => k.keyword).filter(Boolean);
    const target = conn?.gscSiteUrl ? hostFromGscSiteUrl(conn.gscSiteUrl) : null;
    if (!kws.length || !target) continue; // 대상/키워드 없으면 무인 수집 대상 아님
    config[clientId] = { keywords: kws, target, channel: "web" };
  }
  return config;
}

/** 월간 성과수집(무인) — DB에서 설정을 구성해 수집 실행. reportingMonth 미지정 시 이번 달 1일. */
export async function runMonthlyPerformanceCollectionAuto(
  reportingMonth?: Date | string,
): Promise<{ reports: number; totalRanks: number; configuredClients: number }> {
  const month =
    reportingMonth ??
    (() => {
      const n = new Date();
      return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
    })();
  const config = await buildMonthlyPerfConfig(month);
  const res = await runMonthlyPerformanceCollection(month, config);
  return { ...res, configuredClients: Object.keys(config).length };
}
