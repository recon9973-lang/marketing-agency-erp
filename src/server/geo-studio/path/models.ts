// GEO Studio · M4 Path Analyzer — 도메인 모델 (원본 models.py 이식).
import { pyRound } from "../py-compat";

export type JourneyNode = {
  query: string;
  depth: number;
  brandMentioned: boolean;
  mentionStrength: number;
  citedUrls: string[];
  aiSources: string[];
  children: JourneyNode[];
};

export function makeNode(p: Partial<JourneyNode> & { query: string }): JourneyNode {
  return { depth: 0, brandMentioned: false, mentionStrength: 0, citedUrls: [], aiSources: [], children: [], ...p };
}

/** 전위 순회 — 모든 노드. */
export function walk(node: JourneyNode): JourneyNode[] {
  const out: JourneyNode[] = [node];
  for (const c of node.children) out.push(...walk(c));
  return out;
}

export function nodeToDict(node: JourneyNode): Record<string, unknown> {
  return {
    query: node.query,
    depth: node.depth,
    brand_mentioned: node.brandMentioned,
    mention_strength: node.mentionStrength,
    cited_urls: node.citedUrls,
    ai_sources: node.aiSources,
    children: node.children.map(nodeToDict)
  };
}

export type JourneyTree = { brand: string; seedQuery: string; root: JourneyNode; maxDepth: number };

export function totalNodes(tree: JourneyTree): number {
  return walk(tree.root).length;
}

export function brandMentionRate(tree: JourneyTree): number {
  const nodes = walk(tree.root);
  if (nodes.length === 0) return 0.0;
  const hit = nodes.reduce((n, x) => n + (x.brandMentioned ? 1 : 0), 0);
  return pyRound((hit / nodes.length) * 100, 1);
}

export function gapNodes(tree: JourneyTree): JourneyNode[] {
  return walk(tree.root).filter((n) => !n.brandMentioned);
}

export function treeToRow(tree: JourneyTree): Record<string, unknown> {
  return {
    seed_query: tree.seedQuery,
    tree_data: nodeToDict(tree.root),
    total_nodes: totalNodes(tree),
    brand_mention_rate: brandMentionRate(tree),
    max_depth: tree.maxDepth
  };
}

export type TopicalAuthority = {
  domain: string;
  taScore: number;
  coverageScore: number;
  qualityScore: number;
  trustScore: number;
  topicClusterCount: number;
  detail: Record<string, unknown>;
};

export function taToRow(t: TopicalAuthority): Record<string, unknown> {
  return {
    domain: t.domain,
    ta_score: t.taScore,
    coverage_score: t.coverageScore,
    quality_score: t.qualityScore,
    trust_score: t.trustScore,
    topic_cluster_count: t.topicClusterCount
  };
}

export type ClusterTopic = { topic: string; cep: string; priority: number; exists: boolean; action: string };
export type ClusterPlan = { pillarTopic: string; clusterTopics: ClusterTopic[]; coverageRate: number; taImpactEstimate: number };

export function clusterPlanToRow(p: ClusterPlan): Record<string, unknown> {
  return {
    pillar_topic: p.pillarTopic,
    cluster_topics: p.clusterTopics,
    coverage_rate: p.coverageRate,
    ta_impact_estimate: p.taImpactEstimate
  };
}

export type SourceTrace = {
  query: string;
  aiSource: string;
  citedUrls: string[];
  ownUrls: string[];
  competitorUrls: string[];
  brandCited: boolean;
};
