// GEO CEP · 실측 파인더 — 목업 대체(정직성 원칙).
// 데이터 소스를 실측으로 바꾼다: 네이버 검색광고 연관키워드(실측·무료) → OpenAI 임베딩(실측)
//   → 코사인 k-means 군집 = 진짜 의도 클러스터(CEP). 리스닝마인드식 방법론의 실측 재현.
// 정직성: 키 미설정이면 가짜를 만들지 않고 data_tier="demo" + 빈 결과 + 안내를 반환한다.
import { fetchRelatedKeywords, naverSearchConfigured } from "@/server/integrations/naver-search";
import { embedTexts, embeddingsConfigured } from "@/server/ai/embeddings";
import { clusterCandidates, dedupClusters } from "./cluster";
import { priorityScore } from "./scoring";
import { buildCep } from "./finder";
import { cepToRow, type CepCandidate } from "./models";

export type CepDataTier = "measured" | "demo";

export type LiveCepReport = {
  data_tier: CepDataTier;
  brand: string;
  category: string;
  seed: string;
  scan_date: string;
  candidate_count: number;
  total_ceps: number;
  whitespace_count: number;
  ceps: Record<string, unknown>[];
  top_ceps: string[];
  note?: string; // 데모 사유 안내
  sources: { relatedKeywords: boolean; embeddings: boolean };
};

/** 실측 CEP 파인더 사용 가능 여부 — 연관키워드(검색광고) + 임베딩(OpenAI) 둘 다 필요. */
export function cepRealConfigured(): boolean {
  return naverSearchConfigured() && embeddingsConfigured();
}

export type LiveDiscoverOptions = {
  seedKeyword?: string; // 없으면 category를 시드로
  nClusters?: number;
  dedupThreshold?: number;
  scanDate?: string;
  limit?: number;
};

/**
 * 실측 CEP 발굴. 실측 불가 시 절대 지어내지 않고 데모 리포트를 반환한다.
 */
export async function discoverCepsLive(
  brand: string,
  category: string,
  opts: LiveDiscoverOptions = {}
): Promise<LiveCepReport> {
  const seed = (opts.seedKeyword || category).trim();
  const scanDate = opts.scanDate ?? new Date().toISOString();
  const sources = { relatedKeywords: naverSearchConfigured(), embeddings: embeddingsConfigured() };

  const demo = (note: string): LiveCepReport => ({
    data_tier: "demo",
    brand,
    category,
    seed,
    scan_date: scanDate,
    candidate_count: 0,
    total_ceps: 0,
    whitespace_count: 0,
    ceps: [],
    top_ceps: [],
    note,
    sources
  });

  if (!sources.relatedKeywords) return demo("네이버 검색광고 키 미연결 — 연관키워드 실측 불가(데모).");
  if (!sources.embeddings) return demo("OpenAI 임베딩 키 미연결 — 의미 군집 실측 불가(데모).");

  // 실측 호출(네이버·OpenAI)이 실패해도 화면을 죽이지 않는다 — 데모로 폴백.
  try {
    return await runRealCep(brand, category, seed, scanDate, sources, opts);
  } catch (e) {
    console.warn(`[geo-cep] 실측 CEP 실패(${seed}): ${String(e).slice(0, 120)}`);
    return demo("실측 조회 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
  }
}

async function runRealCep(
  brand: string,
  category: string,
  seed: string,
  scanDate: string,
  sources: { relatedKeywords: boolean; embeddings: boolean },
  opts: LiveDiscoverOptions
): Promise<LiveCepReport> {
  const demo = (note: string): LiveCepReport => ({
    data_tier: "demo", brand, category, seed, scan_date: scanDate,
    candidate_count: 0, total_ceps: 0, whitespace_count: 0, ceps: [], top_ceps: [], note, sources
  });

  // 1) 실측 연관키워드(절대 검색량 동반, 총검색량 내림차순)
  const rows = await fetchRelatedKeywords(seed, opts.limit ?? 120);
  if (rows.length < 3) return demo(`연관키워드가 부족합니다(${rows.length}개). 시드를 넓혀 다시 시도하세요.`);

  const candidates: CepCandidate[] = rows.map((r) => ({
    text: r.keyword,
    sourceAi: "naver",
    keyword: r.keyword,
    probe: seed,
    brandMentioned: false,
    competitorsMentioned: []
  }));

  // 2) 실측 임베딩 → 3) 코사인 k-means 군집(실측 재사용)
  const vectors = await embedTexts(candidates.map((c) => c.text));
  const k = Math.max(2, Math.min(opts.nClusters ?? 15, candidates.length));
  let clusters = clusterCandidates(candidates, vectors, k);
  clusters = dedupClusters(clusters, opts.dedupThreshold ?? 0.92);

  const ceps = clusters.map((cl) => buildCep(cl, brand));
  const kwCeiling = Math.max(1, ...ceps.map((c) => c.keywords.length));
  for (const c of ceps) {
    c.priorityScore = priorityScore(c.aiMentionCount, c.competitorNames.length, c.keywords.length, {
      mentionCeiling: 1,
      competitorCeiling: 1,
      keywordCeiling: kwCeiling
    });
  }
  const sorted = ceps
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.priorityScore - a.c.priorityScore || a.i - b.i)
    .map((x) => x.c);

  return {
    data_tier: "measured",
    brand,
    category,
    seed,
    scan_date: scanDate,
    candidate_count: candidates.length,
    total_ceps: sorted.length,
    whitespace_count: sorted.filter((c) => c.isWhitespace).length,
    ceps: sorted.map(cepToRow),
    top_ceps: sorted.slice(0, 10).map((c) => c.cepText),
    sources
  };
}
