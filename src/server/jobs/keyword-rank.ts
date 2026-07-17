// 목표 경로: src/server/jobs/keyword-rank.ts (+ 스케줄러/크론에서 호출)
//
// 키워드 순위 자동수집(B). 거래처 계약 키워드의 네이버 검색 노출 순위를 수집해
// 해당 월 Report.metrics(JSON)에 적재. 나머지 지표는 수기.
//
// 리팩터링 이력:
//   - 구버전: KW_PROXY_URL 프록시 엔드포인트에 위임 (홈페이지 레포 api/kw-proxy.js 재활용)
//   - 현재: naverResearch.rankCheck()로 통합 — 크론·배치도 동일 provider 사용, 단일 진실 공급원.
//   - 정기 배치 표준 경로는 research.ts의 runMonthlyPerformanceCollection을 우선 사용.
//     이 파일은 KW_PROXY_URL 마이그레이션 과도기를 위한 래퍼로 유지.

import { db } from "@/server/db";
import { naverResearch } from "@/server/marketing/providers/naver";

export type KeywordRank = { keyword: string; rank: number | null; checkedAt: string };

/**
 * 키워드 배열의 네이버 검색 순위를 수집한다.
 * naverResearch.rankCheck()에 위임 — NAVER_SEARCH_CLIENT_ID/SECRET 미설정 시 null 순위 반환.
 *
 * @param keywords 조회할 키워드 목록
 * @param opts.target 순위를 측정할 대상 도메인/플레이스명 (없으면 rank null)
 * @param opts.channel 검색 채널 (기본: blog)
 */
export async function fetchKeywordRanks(
  keywords: string[],
  opts?: { target?: string; channel?: "blog" | "web" | "local" }
): Promise<KeywordRank[]> {
  if (!keywords.length) return [];

  const result = await naverResearch.rankCheck({
    keywords,
    target: opts?.target ?? "",
    channel: opts?.channel ?? "blog",
  });

  // provider 실패 시(CONFIG_MISSING 등): 모든 키워드를 rank: null 로 반환(배치 무중단)
  if (!result.ok) {
    const checkedAt = new Date().toISOString();
    return keywords.map((keyword) => ({ keyword, rank: null, checkedAt }));
  }

  return result.data;
}

/**
 * 특정 보고서에 키워드 순위 수집분을 병합.
 * metrics.keywordRanks 에 저장(수기 지표는 보존).
 */
export async function collectKeywordRanksForReport(params: {
  reportId: string;
  keywords: string[];
  target?: string;
  channel?: "blog" | "web" | "local";
}): Promise<{ collected: number }> {
  const report = await db.report.findUnique({ where: { id: params.reportId } });
  if (!report) throw new Error("NOT_FOUND");

  const ranks = await fetchKeywordRanks(params.keywords, {
    target: params.target,
    channel: params.channel,
  });
  const prev = (report.metrics as Record<string, unknown> | null) ?? {};
  const merged = { ...prev, keywordRanks: ranks, keywordRanksCollectedAt: new Date().toISOString() };

  await db.report.update({ where: { id: params.reportId }, data: { metrics: merged as never } });
  return { collected: ranks.length };
}

/**
 * 월간 배치: reportingMonth의 모든 보고서에 대해 키워드 순위 수집.
 * 거래처별 계약 키워드는 ClientAccount/설정에서 관리한다고 가정(여기선 인자로 주입).
 * 크론(예: 매일/주1회)에서 호출.
 *
 * ※ 표준 배치 경로: research.ts의 runMonthlyPerformanceCollection() 권장
 *   (트렌드·경쟁강도 포함 + Report.metrics.performance 구조화 저장).
 *   이 함수는 순위만 필요한 경량 배치용 대안.
 */
export async function runMonthlyKeywordCollection(
  reportingMonth: string,
  keywordsByClient: Record<string, { keywords: string[]; target?: string; channel?: "blog" | "web" | "local" }>
): Promise<{ reports: number; totalRanks: number }> {
  const reports = await db.report.findMany({
    where: { reportingMonth, status: { in: ["DRAFT", "REVIEW_NEEDED"] } },
    select: { id: true, clientId: true }
  });
  let totalRanks = 0;
  for (const r of reports) {
    const cfg = keywordsByClient[r.clientId];
    if (!cfg?.keywords?.length) continue;
    const { collected } = await collectKeywordRanksForReport({
      reportId: r.id,
      keywords: cfg.keywords,
      target: cfg.target,
      channel: cfg.channel,
    });
    totalRanks += collected;
  }
  return { reports: reports.length, totalRanks };
}
