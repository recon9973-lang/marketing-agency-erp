// GEO Studio · M1 GEO 스캐너 — 스캔 오케스트레이션 (원본 scanner.py 이식).
// 키워드 × 변형 × AI를 돌며 응답마다 브랜드·경쟁사 언급을 감지해 ScanResult로 모은다.
// 경쟁사는 별도 쿼리 없이 같은 응답을 재사용하므로 API 비용이 늘지 않는다.
// 파이썬은 asyncio.as_completed로 완료 순서가 비결정적이지만, TS 이식은 재현성을 위해
// 플랫폼 × 쿼리 순서를 결정적으로 순회한다(집계 결과는 순서와 무관).
import { aggregate, type ScanResult } from "./analytics";
import { queryAi, SCAN_PLATFORMS } from "./clients";
import { detect } from "./detector";
import { buildQueries, promptFor, type Query } from "./queries";

function scanOne(platform: string, query: Query, brand: string, competitors: string[]): ScanResult {
  const prompt = promptFor(query, platform);
  const res = queryAi(platform, prompt, brand, competitors);
  const hit = detect(res.text, brand);
  const competitorHits: Record<string, boolean> = {};
  for (const c of competitors) competitorHits[c] = detect(res.text, c).mentioned;
  return {
    platform,
    keyword: query.keyword,
    variation: query.variation,
    prompt,
    responseText: res.text,
    mentioned: hit.mentioned,
    mentionCount: hit.count,
    contexts: hit.contexts,
    responseMs: res.responseMs,
    mocked: res.mocked,
    error: res.error,
    competitorHits
  };
}

export type ScanPayload = Record<string, unknown> & {
  results: ScanResult[];
  keywords: string[];
  platforms: string[];
  variations: number;
};

export function scan(
  brand: string,
  keywords: string[],
  competitors: string[] = [],
  platforms: string[] = [...SCAN_PLATFORMS],
  variations = 3,
  scanDate = "",
): ScanPayload {
  const unknown = platforms.filter((p) => !SCAN_PLATFORMS.includes(p as (typeof SCAN_PLATFORMS)[number]));
  if (unknown.length) throw new Error(`알 수 없는 AI 플랫폼: ${[...new Set(unknown)].sort().join(", ")}`);

  const queries = buildQueries(keywords, variations);
  const results: ScanResult[] = [];
  for (const p of platforms) for (const q of queries) results.push(scanOne(p, q, brand, competitors));

  const payload = aggregate(results, brand, competitors) as ScanPayload;
  payload.scan_date = scanDate;
  payload.keywords = keywords;
  payload.platforms = platforms;
  payload.variations = variations;
  payload.results = results;
  return payload;
}
