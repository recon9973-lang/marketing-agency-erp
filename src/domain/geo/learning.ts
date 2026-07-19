// GEO 학습 — 실험 장부(개입→인용률 변화)에서 전략 가중치를 학습(투명·설명가능).
// 블랙박스 ML이 아니라, 종류별 실측 상승폭(avgLift)·상승비율(upRate)·표본(n)을 결합해
// "어떤 개입에 우선순위를 둘지" 가중치를 산출한다. 표본이 작으면 축소(shrinkage)로 과신 방지.
import { interventionKindLabels, type KindSummary } from "./intervention";

export type LearnedWeight = {
  kind: string;
  label: string;
  avgLift: number; // 평균 인용률 변화(%p)
  upRate: number; // 상승 비율(0~1)
  n: number; // 표본 수(결과 측정된 개입)
  weight: number; // 우선순위 가중치(0~100, 합계≈100)
};

export type LearnedModel = {
  weights: LearnedWeight[];
  basisCount: number; // 학습 표본 총합
  summary: string; // 한 줄 요약(무엇이 유효한가)
};

// 표본 축소 상수 — n이 작을수록 가중치를 보수적으로(신뢰 낮음).
const SHRINK = 3;

/**
 * 종류별 요약(summarizeByKind) → 학습 가중치.
 * raw = max(0, 평균상승폭) × 상승비율 × 신뢰(n/(n+SHRINK)). 정규화해 합 100.
 */
export function learnWeights(summaries: KindSummary[]): LearnedModel {
  const basisCount = summaries.reduce((s, x) => s + x.n, 0);
  const raw = summaries.map((s) => {
    const lift = Math.max(0, s.avgDeltaPoints ?? 0);
    const conf = s.n / (s.n + SHRINK);
    return { s, r: lift * (s.upRate ?? 0) * conf };
  });
  const total = raw.reduce((a, b) => a + b.r, 0);
  const weights: LearnedWeight[] = raw
    .map(({ s, r }) => ({
      kind: s.kind,
      label: interventionKindLabels[s.kind] ?? s.kind,
      avgLift: s.avgDeltaPoints ?? 0,
      upRate: s.upRate ?? 0,
      n: s.n,
      weight: total > 0 ? Math.round((r / total) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.weight - a.weight);

  const top = weights.find((w) => w.weight > 0);
  const summary = top
    ? `가장 효과적: ${top.label}(평균 +${top.avgLift}%p, 상승률 ${Math.round(top.upRate * 100)}%, 표본 ${top.n})`
    : "유효한 상승 신호가 아직 부족합니다(표본을 더 모으세요).";

  return { weights, basisCount, summary };
}

export type WeightDiff = {
  kind: string;
  label: string;
  before: number | null; // 이전 가중치(없으면 null=신규)
  after: number | null; // 이후 가중치(없으면 null=제거)
  delta: number; // after - before
};

/** 두 가중치 세트의 변경점(업그레이드 diff 표시용). 변화 큰 순. */
export function diffWeights(prev: LearnedWeight[], next: LearnedWeight[]): WeightDiff[] {
  const byKind = (arr: LearnedWeight[]) => new Map(arr.map((w) => [w.kind, w]));
  const p = byKind(prev);
  const n = byKind(next);
  const kinds = new Set([...p.keys(), ...n.keys()]);
  const out: WeightDiff[] = [];
  for (const k of kinds) {
    const before = p.get(k)?.weight ?? null;
    const after = n.get(k)?.weight ?? null;
    const delta = Math.round(((after ?? 0) - (before ?? 0)) * 10) / 10;
    out.push({ kind: k, label: interventionKindLabels[k] ?? k, before, after, delta });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * 새 버전을 제안할 가치가 있는지 — 표본이 최소치 이상이고, 직전 대비 유의미한 변화가 있을 때.
 * minBasis: 최소 표본, minShift: 최대 가중치 변화 임계(%p).
 */
export function shouldProposeVersion(
  prev: LearnedWeight[] | null,
  next: LearnedModel,
  minBasis = 5,
  minShift = 5
): boolean {
  if (next.basisCount < minBasis) return false;
  if (!prev || prev.length === 0) return next.weights.some((w) => w.weight > 0);
  const maxShift = Math.max(0, ...diffWeights(prev, next.weights).map((d) => Math.abs(d.delta)));
  return maxShift >= minShift;
}
