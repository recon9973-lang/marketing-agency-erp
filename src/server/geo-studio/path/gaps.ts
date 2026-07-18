// GEO Studio · M4 Path Analyzer — 갭 경로 분석 (원본 gaps.py 이식).
import { pyRound } from "../py-compat";
import { gapNodes, type JourneyNode, type JourneyTree } from "./models";

export type GapPath = { query: string; depth: number; priority: number; childCount: number; competitorPresent: boolean };

/** 상류(depth 낮음) + 허브(자식 많음)일수록 높은 우선순위 0~100. */
function pathPriority(node: JourneyNode): number {
  const depthFactor = Math.max(0.0, 1.0 - node.depth * 0.25);
  const hubFactor = Math.min(1.0, node.children.length / 3.0);
  return pyRound((depthFactor * 0.7 + hubFactor * 0.3) * 100, 1);
}

/** 브랜드 미언급 노드를 우선순위 순으로. */
export function analyzeGaps(tree: JourneyTree): GapPath[] {
  const gaps: GapPath[] = gapNodes(tree).map((node) => ({
    query: node.query,
    depth: node.depth,
    priority: pathPriority(node),
    childCount: node.children.length,
    competitorPresent: node.citedUrls.length > 0
  }));
  // 우선순위 내림차순(안정 정렬 — 동점은 순회 순서 유지)
  return gaps.map((g, i) => ({ g, i })).sort((a, b) => b.g.priority - a.g.priority || a.i - b.i).map((x) => x.g);
}

/** 루트→리프 경로 Top N (길이 내림차순). */
export function topPaths(tree: JourneyTree, limit = 10): string[][] {
  const paths: string[][] = [];
  const dfs = (node: JourneyNode, trail: string[]): void => {
    const t = [...trail, node.query];
    if (node.children.length === 0) paths.push(t);
    for (const c of node.children) dfs(c, t);
  };
  dfs(tree.root, []);
  return paths
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.length - a.p.length || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}
