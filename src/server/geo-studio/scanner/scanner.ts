// GEO Studio · M1 GEO 스캐너 — 스캔 오케스트레이션 (원본 scanner.py 이식).
// 키워드 × 변형 × AI를 돌며 응답마다 브랜드·경쟁사 언급을 감지해 ScanResult로 모은다.
// 경쟁사는 별도 쿼리 없이 같은 응답을 재사용하므로 API 비용이 늘지 않는다.
// 파이썬은 asyncio.as_completed로 완료 순서가 비결정적이지만, TS 이식은 재현성을 위해
// 플랫폼 × 쿼리 순서를 결정적으로 순회한다(집계 결과는 순서와 무관).
import { aggregate, type ScanResult } from "./analytics";
import { queryAi, queryAiLive, anyPlatformLive, SCAN_PLATFORMS } from "./clients";
import { detect } from "./detector";
import { buildQueries, promptFor, type Query } from "./queries";

function resultFrom(res: { text: string; responseMs: number; mocked: boolean; error: string | null }, platform: string, query: Query, brand: string, competitors: string[]): ScanResult {
  const hit = detect(res.text, brand);
  const competitorHits: Record<string, boolean> = {};
  for (const c of competitors) competitorHits[c] = detect(res.text, c).mentioned;
  return {
    platform,
    keyword: query.keyword,
    variation: query.variation,
    prompt: promptFor(query, platform),
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

function scanOne(platform: string, query: Query, brand: string, competitors: string[]): ScanResult {
  const res = queryAi(platform, promptFor(query, platform), brand, competitors);
  return resultFrom(res, platform, query, brand, competitors);
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

  return finalize(results, brand, competitors, keywords, platforms, variations, scanDate);
}

function finalize(results: ScanResult[], brand: string, competitors: string[], keywords: string[], platforms: string[], variations: number, scanDate: string): ScanPayload {
  const payload = aggregate(results, brand, competitors) as ScanPayload;
  payload.scan_date = scanDate;
  payload.keywords = keywords;
  payload.platforms = platforms;
  payload.variations = variations;
  payload.results = results;
  // 화면 배지용 — 하나라도 실호출됐으면 live. 전부 목이면 데모.
  payload.mocked = results.length > 0 && results.every((r) => r.mocked);
  payload.live = results.some((r) => !r.mocked);
  return payload;
}

/**
 * 실측 우선 스캔 — 연결된 플랫폼은 실제 AI를 호출한다(mocked:false), 미연결은 목.
 * 플랫폼×쿼리를 병렬 호출(Promise.all)해 지연을 최소화. 하나라도 실호출되면 payload.live=true.
 */
export async function scanLive(
  brand: string,
  keywords: string[],
  competitors: string[] = [],
  platforms: string[] = [...SCAN_PLATFORMS],
  variations = 3,
  scanDate = ""
): Promise<ScanPayload> {
  const unknown = platforms.filter((p) => !SCAN_PLATFORMS.includes(p as (typeof SCAN_PLATFORMS)[number]));
  if (unknown.length) throw new Error(`알 수 없는 AI 플랫폼: ${[...new Set(unknown)].sort().join(", ")}`);

  const queries = buildQueries(keywords, variations);
  const pairs: { p: string; q: Query }[] = [];
  for (const p of platforms) for (const q of queries) pairs.push({ p, q });
  const results = await Promise.all(
    pairs.map(async ({ p, q }) => {
      const res = await queryAiLive(p, promptFor(q, p), brand, competitors);
      return resultFrom(res, p, q, brand, competitors);
    })
  );
  return finalize(results, brand, competitors, keywords, platforms, variations, scanDate);
}

/** 실측 엔진이 하나라도 연결됐는지(화면이 scanLive를 쓸지 판단). */
export { anyPlatformLive };
