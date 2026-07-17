// src/server/marketing/research.ts
//
// S2 · 리서치·성과수집 서비스.
// naver provider(providers/naver.ts)를 사용해:
//   1) 키워드 리서치 스냅샷(트렌드 + 경쟁강도) → KeywordResearch 모델 저장
//   2) 보고서 성과수집(키워드 노출순위 + 경쟁강도) → 기존 Report.metrics(Json)에 병합
//   3) 월간 배치(runMonthlyPerformanceCollection)
//
// 설계 메모(plan-research 3단계 채택안 B):
//   - 기존 keyword-rank.ts를 수정하지 않고 별도 서비스로 추가(무회귀).
//   - clientId 제공 시 KeywordResearch 모델에 저장(마이그레이션 완료).
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
  savedId?: string; // KeywordResearch record id (clientId 제공 시)
};

/**
 * 시드 키워드(+연관어)의 검색 트렌드와 경쟁강도를 수집한다.
 * clientId 가 제공되면 KeywordResearch 모델에 결과를 저장한다.
 */
export async function collectKeywordResearch(input: {
  seedKeyword: string;
  related?: string[];
  clientId?: string;
  workItemId?: string;
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

  const snapshot: KeywordResearchSnapshot = {
    seedKeyword: input.seedKeyword,
    trend: trendRes.ok ? trendRes.data : null,
    competition,
    collectedAt: new Date().toISOString(),
    source: "naver",
    warnings,
  };

  // KeywordResearch 모델에 저장 (clientId 제공 시)
  if (input.clientId) {
    try {
      const saved = await db.keywordResearch.create({
        data: {
          clientId: input.clientId,
          workItemId: input.workItemId ?? null,
          seedKeyword: input.seedKeyword,
          results: {
            trend: snapshot.trend,
            competition: snapshot.competition,
            warnings: snapshot.warnings,
          } as never,
          source: snapshot.source,
          collectedAt: new Date(snapshot.collectedAt),
        },
        select: { id: true },
      });
      snapshot.savedId = saved.id;
    } catch (err) {
      // DB 저장 실패 시 결과는 반환하되 경고만 추가(dev 환경 DB 없는 경우 등)
      warnings.push(`persist:${(err as Error).message?.slice(0, 60)}`);
    }
  }

  return snapshot;
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
