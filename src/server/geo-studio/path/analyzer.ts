// GEO Studio · M4 Path Analyzer — 오케스트레이션 (원본 analyzer.py 이식).
// 여정 탐색 → 갭 분석 → (선택) Topical Authority + 클러스터 계획 결합.
import { computeTa } from "./authority";
import { cepItem, planClusters } from "./clusters";
import { analyzeGaps, topPaths } from "./gaps";
import { exploreJourney, type ExploreOptions } from "./journey";
import { exploreJourneyLive } from "./journey-live";
import { brandMentionRate, clusterPlanToRow, nodeToDict, taToRow, totalNodes, type JourneyTree } from "./models";

export type JourneyReport = {
  brand: string;
  seed_query: string;
  scan_date: string;
  total_nodes: number;
  brand_mention_rate: number;
  max_depth: number;
  tree: Record<string, unknown>;
  gap_count: number;
  top_gaps: Array<{ query: string; priority: number; depth: number }>;
  top_paths: string[][];
};

/** 트리 → 리포트 조립(목/실측 공통). */
function buildJourneyReport(tree: JourneyTree, brand: string, seedQuery: string, scanDate: string): JourneyReport {
  const gaps = analyzeGaps(tree);
  return {
    brand,
    seed_query: seedQuery,
    scan_date: scanDate,
    total_nodes: totalNodes(tree),
    brand_mention_rate: brandMentionRate(tree),
    max_depth: tree.maxDepth,
    tree: nodeToDict(tree.root),
    gap_count: gaps.length,
    top_gaps: gaps.slice(0, 10).map((g) => ({ query: g.query, priority: g.priority, depth: g.depth })),
    top_paths: topPaths(tree, 10)
  };
}

/** 여정 탐색 + 갭 분석 리포트(목 — 결정적). */
export function analyzeJourney(brand: string, seedQuery: string, opts: ExploreOptions & { scanDate?: string } = {}): JourneyReport {
  const tree = exploreJourney(seedQuery, brand, opts);
  return buildJourneyReport(tree, brand, seedQuery, opts.scanDate ?? new Date().toISOString());
}

/**
 * 실측 근사 여정 — 네이버 연관키워드 인접 그래프로 트리 구성(리스닝마인드식).
 * 주의: AI 답변 클릭스트림이 아니라 '연관키워드 확장 경로'다(정직 표기 필요).
 * 미연결(검색광고 키 없음)이면 null → 호출부가 목으로 폴백.
 */
export async function analyzeJourneyLive(brand: string, seedQuery: string, scanDate?: string): Promise<JourneyReport | null> {
  try {
    const tree = await exploreJourneyLive(seedQuery, brand);
    if (!tree) return null;
    return buildJourneyReport(tree, brand, seedQuery, scanDate ?? new Date().toISOString());
  } catch (e) {
    // 실측 실패는 화면을 죽이지 않는다 — null 반환 → 호출부가 목으로 폴백.
    console.warn(`[geo-path] 실측 여정 실패(${seedQuery}): ${String(e).slice(0, 120)}`);
    return null;
  }
}

/** 여정 리포트 + Topical Authority + 클러스터 계획 결합. */
export function fullReport(
  journeyReport: JourneyReport,
  args: { domain: string; coveredCeps: number; totalCeps: number; geoScores: number[]; pillarTopic: string; ceps: string[]; existingTopics: string[] }
): Record<string, unknown> {
  const ta = computeTa({
    domain: args.domain,
    coveredCeps: args.coveredCeps,
    totalCeps: args.totalCeps,
    geoScores: args.geoScores,
    aiMentionRate: journeyReport.brand_mention_rate,
    topicClusterCount: args.ceps.length
  });
  const plan = planClusters(args.pillarTopic, args.ceps.map((c) => cepItem(c)), args.existingTopics, ta.qualityScore);
  return { ...journeyReport, topical_authority: taToRow(ta), cluster_plan: clusterPlanToRow(plan) };
}
