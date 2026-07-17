// GEO Studio · M2 CEP 파인더 — 발굴 오케스트레이션 (원본 finder.py 이식).
// 프로브 → (목)4-AI 인터로게이션 → 추출 → 임베딩 → 클러스터/중복제거 →
// 5차원 태깅·점수화 → 경쟁맵/화이트스페이스 → 리포트(기획안 5.3).
// ⚠️ 목 기반(dev). 라이브 4-AI·실 임베딩은 P0 LLM 레이어에서 주입.
import { buildProbesMulti } from "./probes";
import { extractCandidates } from "./extract";
import { mockEmbedTexts } from "./embedding";
import { clusterCandidates, dedupClusters, type Cluster } from "./cluster";
import { tagCluster, representativeText } from "./tagging";
import { priorityScore, isWhitespace } from "./scoring";
import { buildCompetitorMap, competitorToRow, shareOfCeps, whitespaceCeps, overlapCeps } from "./competitors";
import { CEP_PLATFORMS, mockResponse } from "./clients";
import { makeCep, cepToRow, type Cep, type CepCandidate } from "./models";

// 목 클러스터링 임베딩 차원 — 성능용 축소(파이썬 파리티 골든은 1536을 명시 사용).
// 라이브 임베딩(text-embedding-3-large=3072/1536)은 P0에서 주입되며 차원과 무관하게 동작.
const FINDER_EMBED_DIM = 256;

function uniqSorted(values: string[]): string[] {
  // 파이썬 sorted(set(...)) — BMP(한글/ASCII) 코드포인트 순 = JS 기본 정렬과 동일.
  return [...new Set(values)].sort();
}

function buildCep(cluster: Cluster, _brand: string): Cep {
  const texts = cluster.members.map((m) => m.text);
  const tags = tagCluster(texts);
  const rep = representativeText(texts) || texts[0];
  const brandMentions = cluster.members.filter((m) => m.brandMentioned).length;
  const competitorNames = uniqSorted(cluster.members.flatMap((m) => m.competitorsMentioned));
  const keywords = uniqSorted(cluster.members.map((m) => m.keyword));
  const sourceAis = uniqSorted(cluster.members.map((m) => m.sourceAi));
  return makeCep({
    cepText: rep,
    situationTag: tags.situation,
    emotionTag: tags.emotion,
    timeTag: tags.time,
    placeTag: tags.place,
    companionTag: tags.companion,
    aiMentionCount: brandMentions,
    keywords,
    sourceAis,
    memberTexts: texts,
    brandMentionCount: brandMentions,
    competitorNames,
    isWhitespace: isWhitespace(brandMentions, competitorNames.length)
  });
}

export type DiscoverOptions = {
  competitors?: string[];
  extraKeywords?: string[];
  platforms?: string[];
  perDimension?: number;
  nClusters?: number;
  dedupThreshold?: number;
  scanDate?: string; // ISO. 미지정 시 현재시각(결정성 필요한 호출부는 명시).
};

export type CepReport = Record<string, unknown>;

/** 브랜드·카테고리로 CEP를 발굴하고 기획안 5.3 형태의 리포트를 반환(목 기반·결정적). */
export function discoverCeps(brand: string, category: string, opts: DiscoverOptions = {}): CepReport {
  const competitors = opts.competitors ?? [];
  const platforms = opts.platforms ?? [...CEP_PLATFORMS];
  const unknown = platforms.filter((p) => !(CEP_PLATFORMS as readonly string[]).includes(p));
  if (unknown.length) throw new Error(`알 수 없는 AI 플랫폼: ${unknown.sort().join(", ")}`);

  const scanDate = opts.scanDate ?? new Date().toISOString();
  const probes = buildProbesMulti(category, opts.extraKeywords, opts.perDimension ?? 4);

  // 결정적 순서: platform-major, probe-minor (원본 as_completed의 비결정 순서를 고정)
  const candidates: CepCandidate[] = [];
  for (const p of platforms) {
    for (const pr of probes) {
      const text = mockResponse(p, pr.text, brand, competitors);
      candidates.push(...extractCandidates({ platform: p, text }, category, pr.text, brand, competitors));
    }
  }

  const base = {
    brand,
    category,
    scan_date: scanDate,
    platforms,
    probe_count: probes.length
  };

  if (candidates.length === 0) {
    return {
      ...base,
      candidate_count: 0,
      total_ceps: 0,
      whitespace_count: 0,
      ceps: [],
      top_ceps: [],
      whitespace_ceps: [],
      overlap_ceps: [],
      cep_share: {},
      competitor_map: []
    };
  }

  const vectors = mockEmbedTexts(candidates.map((c) => c.text), FINDER_EMBED_DIM);
  let clusters = clusterCandidates(candidates, vectors, opts.nClusters ?? 15);
  clusters = dedupClusters(clusters, opts.dedupThreshold ?? 0.92);

  const ceps = clusters.map((cl) => buildCep(cl, brand));
  const mentionCeiling = (ceps.length ? Math.max(...ceps.map((c) => c.aiMentionCount)) : 1) || 1;
  const competitorCeiling = (ceps.length ? Math.max(...ceps.map((c) => c.competitorNames.length)) : 1) || 1;
  const keywordCeiling = (ceps.length ? Math.max(...ceps.map((c) => c.keywords.length)) : 1) || 1;
  for (const c of ceps) {
    c.priorityScore = priorityScore(c.aiMentionCount, c.competitorNames.length, c.keywords.length, {
      mentionCeiling,
      competitorCeiling,
      keywordCeiling
    });
  }
  // priority 내림차순(안정 정렬 — 동점은 클러스터 순서 유지)
  const sorted = ceps
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.priorityScore - a.c.priorityScore || a.i - b.i)
    .map((x) => x.c);

  const compRows = [];
  for (const c of sorted) {
    const memberSet = new Set(c.memberTexts);
    const memberCandidates = candidates.filter((cand) => memberSet.has(cand.text));
    compRows.push(...buildCompetitorMap(c, memberCandidates));
  }

  return {
    ...base,
    candidate_count: candidates.length,
    total_ceps: sorted.length,
    whitespace_count: sorted.filter((c) => c.isWhitespace).length,
    ceps: sorted.map(cepToRow),
    top_ceps: sorted.slice(0, 10).map((c) => c.cepText),
    whitespace_ceps: whitespaceCeps(sorted).map((c) => c.cepText),
    overlap_ceps: overlapCeps(sorted).map((c) => c.cepText),
    cep_share: shareOfCeps(sorted, competitors),
    competitor_map: compRows.map(competitorToRow)
  };
}
