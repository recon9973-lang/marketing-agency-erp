// src/server/marketing/report-assembly.ts
//
// S6 · 월간 리포트 자동조립.
// Report.metrics(S2 성과수집이 적재한 keywordRanks)를 집계해
//   - 평균 순위, 상위 키워드, 전월 대비 순위 상승분
//   - 한국어 요약 코멘트(metrics.summary)
// 를 만들고 Report.metrics에 병합한다. 기존 report-pdf.ts(buildReportHtml)가
// metrics.summary / keywordRanks를 그대로 렌더하므로 PDF에 자동 반영된다.
//
// 순수 집계 로직(summarizeRanks)은 db와 분리해 테스트 가능하게 둔다.

import { db } from "@/server/db";

export type Rank = { keyword: string; rank: number | null };

export type RankSummary = {
  totalKeywords: number;
  rankedCount: number;
  avgRank: number | null;
  top: { keyword: string; rank: number }[];
  improved: { keyword: string; from: number; to: number }[];
  summaryText: string;
};

/** 순수 집계: 이번 달 순위 + 전월 순위 → 요약. db 의존 없음. */
export function summarizeRanks(ranks: Rank[], prevRanks: Rank[] = []): RankSummary {
  const ranked = ranks.filter((r): r is { keyword: string; rank: number } => typeof r.rank === "number");
  const avgRank = ranked.length
    ? Math.round((ranked.reduce((s, r) => s + r.rank, 0) / ranked.length) * 10) / 10
    : null;
  const top = [...ranked].sort((a, b) => a.rank - b.rank).slice(0, 5);

  const prevMap = new Map(prevRanks.filter((r) => typeof r.rank === "number").map((r) => [r.keyword, r.rank as number]));
  const improved = ranked
    .map((r) => ({ keyword: r.keyword, from: prevMap.get(r.keyword), to: r.rank }))
    .filter((x): x is { keyword: string; from: number; to: number } => typeof x.from === "number" && x.to < x.from);

  const parts: string[] = [];
  if (ranked.length) {
    parts.push(`이번 달 총 ${ranks.length}개 키워드 중 ${ranked.length}개가 노출권에 진입했습니다(평균 순위 ${avgRank}위).`);
  } else {
    parts.push("이번 달 노출권에 진입한 키워드가 집계되지 않았습니다.");
  }
  if (top.length) parts.push(`상위 키워드: ${top.map((t) => `${t.keyword}(${t.rank}위)`).join(", ")}.`);
  if (improved.length) {
    parts.push(`전월 대비 상승: ${improved.map((i) => `${i.keyword}(${i.from}→${i.to}위)`).join(", ")}.`);
  }

  return { totalKeywords: ranks.length, rankedCount: ranked.length, avgRank, top, improved, summaryText: parts.join(" ") };
}

function extractRanks(metrics: Record<string, unknown> | null | undefined): Rank[] {
  const r = (metrics as { keywordRanks?: unknown } | null | undefined)?.keywordRanks;
  return Array.isArray(r) ? (r as Rank[]) : [];
}

/**
 * 보고서 월간 조립. 전월 보고서와 비교해 요약을 만들고 metrics.summary/assembled에 병합.
 * @param opts.persist true면 Report.metrics에 저장(기본 true).
 */
export async function assembleMonthlyReport(
  reportId: string,
  opts?: { persist?: boolean },
): Promise<RankSummary & { reportId: string; assembledAt: string }> {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { id: true, clientId: true, reportingMonth: true, metrics: true },
  });
  if (!report) throw new Error("NOT_FOUND");

  const metrics = (report.metrics as Record<string, unknown> | null) ?? {};
  const ranks = extractRanks(metrics);

  const prev = await db.report.findFirst({
    where: { clientId: report.clientId, reportingMonth: { lt: report.reportingMonth } },
    orderBy: { reportingMonth: "desc" },
    select: { metrics: true },
  });
  const prevRanks = extractRanks((prev?.metrics as Record<string, unknown> | null) ?? null);

  const summary = summarizeRanks(ranks, prevRanks);
  const assembledAt = new Date().toISOString();

  if (opts?.persist !== false) {
    const merged = { ...metrics, summary: summary.summaryText, assembled: { ...summary, assembledAt } };
    await db.report.update({ where: { id: reportId }, data: { metrics: merged as never } });
  }

  return { ...summary, reportId, assembledAt };
}
