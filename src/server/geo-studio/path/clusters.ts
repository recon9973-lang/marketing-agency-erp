// GEO Studio · M4 Path Analyzer — 콘텐츠 클러스터 플래너 (원본 clusters.py 이식).
import { pyRound } from "../py-compat";
import { coverageScore, TA_WEIGHTS } from "./authority";
import type { ClusterPlan, ClusterTopic } from "./models";

export type CepItem = { cepText: string; priorityScore: number };
export const cepItem = (cepText: string, priorityScore = 50.0): CepItem => ({ cepText, priorityScore });

/** CEP를 클러스터 주제로 매핑하고 미생성분·TA 향상폭 산출. */
export function planClusters(pillarTopic: string, ceps: CepItem[], existingTopics: string[], _currentGeoAvg = 60.0): ClusterPlan {
  const existingNorm = existingTopics.map((t) => t.trim().toLowerCase());
  const sorted = ceps
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.priorityScore - a.c.priorityScore || a.i - b.i)
    .map((x) => x.c);

  const clusterTopics: ClusterTopic[] = sorted.map((cep) => {
    const t = cep.cepText.trim().toLowerCase();
    const exists = existingNorm.some((e) => e.includes(t) || t.includes(e));
    return { topic: cep.cepText, cep: cep.cepText, priority: cep.priorityScore, exists, action: exists ? "보유" : "생성 필요" };
  });

  const total = clusterTopics.length || 1;
  const covered = clusterTopics.filter((c) => c.exists).length;
  const coverageRate = pyRound((covered / total) * 100, 1);

  const covNow = coverageScore(covered, total);
  const taImpact = pyRound((100.0 - covNow) * TA_WEIGHTS.coverage, 1);

  return { pillarTopic, clusterTopics, coverageRate, taImpactEstimate: taImpact };
}

/** 미생성 클러스터만 우선순위 순으로(→ M3 빌더 연동). */
export function missingClusters(plan: ClusterPlan): ClusterTopic[] {
  return plan.clusterTopics
    .filter((c) => !c.exists)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.priority - a.c.priority || a.i - b.i)
    .map((x) => x.c);
}
