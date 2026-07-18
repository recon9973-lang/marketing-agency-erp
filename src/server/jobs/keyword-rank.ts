// 목표 경로: src/server/jobs/keyword-rank.ts
//
// ⚠️ 미배선 스캐폴드(dead scaffold, 2026-07 기준) — 어떤 크론/라우트/액션에서도 호출되지 않음.
//    라이브 순위수집은 `src/server/marketing/` 파이프라인(guard-rank.ts + providers)이 담당한다.
//    (marketing/research.ts 주석대로 이 파일을 수정하지 않고 별도 서비스로 대체.)
//    삭제 대신 보존: KW_PROXY_URL 기반 월간 일괄수집 골격을 향후 재사용할 수 있음.
//    배선 시 반드시 KW_PROXY_URL env를 integrations/status.ts 레지스트리에 등록할 것.
//
// 키워드 순위 자동수집(B). 거래처 계약 키워드의 네이버 검색 노출 순위를 수집해
// 해당 월 Report.metrics(JSON)에 적재. 나머지 지표는 수기.
//
// 데이터 소스: 베놈 보유 네이버 키워드/검색 API 프록시 재활용(홈페이지 레포 api/kw-proxy.js).
// 여기서는 수집 파이프라인 골격 + metrics 병합을 정의. 실제 순위 파싱은 provider 함수에 위임.
import { db } from "@/server/db";

export type KeywordRank = { keyword: string; rank: number | null; checkedAt: string };

/**
 * provider: 키워드 배열 → 순위 결과. 네이버 검색결과/플레이스 순위 파서로 구현.
 * 프록시 엔드포인트(KW_PROXY_URL)에 위임하거나 직접 파싱.
 */
export async function fetchKeywordRanks(
  keywords: string[],
  opts?: { target?: string } // target: 순위를 측정할 대상 도메인/플레이스ID
): Promise<KeywordRank[]> {
  const base = process.env.KW_PROXY_URL;
  if (!base) throw new Error("KW_PROXY_URL_MISSING");
  const results: KeywordRank[] = [];
  for (const kw of keywords) {
    try {
      const url = `${base}?keyword=${encodeURIComponent(kw)}${opts?.target ? `&target=${encodeURIComponent(opts.target)}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      // 프록시 응답 스키마에 맞춰 rank 추출(예: data.rank). 없으면 null.
      results.push({ keyword: kw, rank: typeof data?.rank === "number" ? data.rank : null, checkedAt: new Date().toISOString() });
    } catch {
      results.push({ keyword: kw, rank: null, checkedAt: new Date().toISOString() });
    }
  }
  return results;
}

/**
 * 특정 보고서에 키워드 순위 수집분을 병합.
 * metrics.keywordRanks 에 저장(수기 지표는 보존).
 */
export async function collectKeywordRanksForReport(params: {
  reportId: string;
  keywords: string[];
  target?: string;
}): Promise<{ collected: number }> {
  const report = await db.report.findUnique({ where: { id: params.reportId } });
  if (!report) throw new Error("NOT_FOUND");

  const ranks = await fetchKeywordRanks(params.keywords, { target: params.target });
  const prev = (report.metrics as Record<string, unknown> | null) ?? {};
  const merged = { ...prev, keywordRanks: ranks, keywordRanksCollectedAt: new Date().toISOString() };

  await db.report.update({ where: { id: params.reportId }, data: { metrics: merged as never } });
  return { collected: ranks.length };
}

/**
 * 월간 배치: reportingMonth의 모든 보고서에 대해 키워드 순위 수집.
 * 거래처별 계약 키워드는 ClientAccount/설정에서 관리한다고 가정(여기선 인자로 주입).
 * 크론(예: 매일/주1회)에서 호출.
 */
export async function runMonthlyKeywordCollection(
  reportingMonth: string,
  keywordsByClient: Record<string, { keywords: string[]; target?: string }>
): Promise<{ reports: number; totalRanks: number }> {
  const reports = await db.report.findMany({
    where: { reportingMonth, status: { in: ["DRAFT", "REVIEW_NEEDED"] } },
    select: { id: true, clientId: true }
  });
  let totalRanks = 0;
  for (const r of reports) {
    const cfg = keywordsByClient[r.clientId];
    if (!cfg?.keywords?.length) continue;
    const { collected } = await collectKeywordRanksForReport({ reportId: r.id, keywords: cfg.keywords, target: cfg.target });
    totalRanks += collected;
  }
  return { reports: reports.length, totalRanks };
}
