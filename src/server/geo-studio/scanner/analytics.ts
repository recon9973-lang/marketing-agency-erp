// GEO Studio · M1 GEO 스캐너 — 언급률 계산·집계 (원본 analytics.py 이식).
import { pyRound } from "../py-compat";

export type ScanResult = {
  platform: string;
  keyword: string;
  variation: string;
  prompt: string;
  responseText: string;
  mentioned: boolean;
  mentionCount: number;
  contexts: string[];
  responseMs: number;
  mocked: boolean;
  error: string | null;
  competitorHits: Record<string, boolean>;
};

const countTrue = (rows: ScanResult[], f: (r: ScanResult) => boolean) => rows.reduce((n, r) => n + (f(r) ? 1 : 0), 0);

/** (언급 쿼리 수 / 유효 쿼리 수) × 100. 에러 응답은 분모 제외. */
export function mentionRate(results: ScanResult[]): number {
  const valid = results.filter((r) => r.error === null);
  if (valid.length === 0) return 0.0;
  return pyRound((countTrue(valid, (r) => r.mentioned) / valid.length) * 100, 1);
}

function groupBy(results: ScanResult[], key: (r: ScanResult) => string): Map<string, ScanResult[]> {
  const m = new Map<string, ScanResult[]>();
  for (const r of results) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

/** 기획안 5-3 집계 결과. */
export function aggregate(results: ScanResult[], brand: string, competitors: string[]): Record<string, unknown> {
  const byPlatform = groupBy(results, (r) => r.platform);

  const byAi: Record<string, unknown> = {};
  for (const [platform, rows] of byPlatform) {
    const valid = rows.filter((r) => r.error === null);
    const contexts = valid.flatMap((r) => r.contexts);
    byAi[platform] = {
      rate: mentionRate(rows),
      mentioned: countTrue(valid, (r) => r.mentioned),
      total: valid.length,
      errors: rows.length - valid.length,
      avg_response_ms: rows.length ? pyRound(rows.reduce((s, r) => s + r.responseMs, 0) / rows.length, 0) : 0,
      mocked: rows.every((r) => r.mocked),
      // 실패 원인 샘플(첫 오류) — 화면에서 왜 실패했는지 바로 보이게(진단용).
      errorSample: rows.find((r) => r.error)?.error ?? null,
      contexts
    };
  }

  const competitorRows = competitors.map((name) => {
    const valid = results.filter((r) => r.error === null);
    const hits = countTrue(valid, (r) => r.competitorHits[name] ?? false);
    const byAiComp: Record<string, number> = {};
    for (const [p, rows] of byPlatform) {
      const v = rows.filter((r) => r.error === null);
      byAiComp[p] = pyRound((countTrue(v, (r) => r.competitorHits[name] ?? false) / Math.max(1, v.length)) * 100, 1);
    }
    return { name, overall_rate: valid.length ? pyRound((hits / valid.length) * 100, 1) : 0.0, by_ai: byAiComp };
  });

  const byKeyword: Record<string, number> = {};
  for (const [kw, rows] of groupBy(results, (r) => r.keyword)) byKeyword[kw] = mentionRate(rows);

  return {
    brand,
    overall_mention_rate: mentionRate(results),
    total_queries: results.length,
    by_ai: byAi,
    by_keyword: byKeyword,
    competitors: competitorRows
  };
}
