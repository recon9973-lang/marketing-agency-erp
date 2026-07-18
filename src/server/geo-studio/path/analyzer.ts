// GEO Studio · M4 Path Analyzer — 오케스트레이션 (원본 analyzer.py 이식).
// 여정 탐색 → 갭 분석 → (선택) Topical Authority + 클러스터 계획 결합.
import { computeTa } from "./authority";
import { cepItem, planClusters } from "./clusters";
import { analyzeGaps, topPaths } from "./gaps";
import { exploreJourney, type ExploreOptions } from "./journey";
import { brandMentionRate, clusterPlanToRow, nodeToDict, taToRow, totalNodes } from "./models";

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

/** 여정 탐색 + 갭 분석 리포트. */
export function analyzeJourney(brand: string, seedQuery: string, opts: ExploreOptions & { scanDate?: string } = {}): JourneyReport {
  const tree = exploreJourney(seedQuery, brand, opts);
  const gaps = analyzeGaps(tree);
  return {
    brand,
    seed_query: seedQuery,
    scan_date: opts.scanDate ?? new Date().toISOString(),
    total_nodes: totalNodes(tree),
    brand_mention_rate: brandMentionRate(tree),
    max_depth: tree.maxDepth,
    tree: nodeToDict(tree.root),
    gap_count: gaps.length,
    top_gaps: gaps.slice(0, 10).map((g) => ({ query: g.query, priority: g.priority, depth: g.depth })),
    top_paths: topPaths(tree, 10)
  };
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
