// GEO Studio · M4 Path Analyzer — Topical Authority 계산 (원본 authority.py 이식).
// TA = 커버리지(40%) + 품질(35%) + AI 신뢰도(25%).
import { pyRound } from "../py-compat";
import type { TopicalAuthority } from "./models";

export const TA_WEIGHTS = { coverage: 0.4, quality: 0.35, trust: 0.25 };
export const DEFAULT_TRUST_BASELINE = 40.0;

export function coverageScore(coveredCeps: number, totalCeps: number): number {
  if (totalCeps <= 0) return 0.0;
  return pyRound(Math.min(1.0, coveredCeps / totalCeps) * 100, 1);
}

export function qualityScore(geoScores: number[]): number {
  if (geoScores.length === 0) return 0.0;
  return pyRound(geoScores.reduce((a, b) => a + b, 0) / geoScores.length, 1);
}

/** AI 인용 빈도(%)를 기준값 대비 정규화. baseline이면 100점. */
export function trustScore(aiMentionRate: number, baseline: number): number {
  if (baseline <= 0) return 0.0;
  return pyRound(Math.min(1.0, aiMentionRate / baseline) * 100, 1);
}

export function computeTa(args: {
  domain: string;
  coveredCeps: number;
  totalCeps: number;
  geoScores: number[];
  aiMentionRate: number;
  topicClusterCount: number;
  trustBaseline?: number;
}): TopicalAuthority {
  const cov = coverageScore(args.coveredCeps, args.totalCeps);
  const qual = qualityScore(args.geoScores);
  const trust = trustScore(args.aiMentionRate, args.trustBaseline ?? DEFAULT_TRUST_BASELINE);
  const ta = pyRound(cov * TA_WEIGHTS.coverage + qual * TA_WEIGHTS.quality + trust * TA_WEIGHTS.trust, 1);

  return {
    domain: args.domain,
    taScore: ta,
    coverageScore: cov,
    qualityScore: qual,
    trustScore: trust,
    topicClusterCount: args.topicClusterCount,
    detail: {
      covered_ceps: args.coveredCeps,
      total_ceps: args.totalCeps,
      content_count: args.geoScores.length,
      ai_mention_rate: args.aiMentionRate,
      weights: TA_WEIGHTS
    }
  };
}
