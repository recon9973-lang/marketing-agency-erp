// GEO Studio · M5 — KPI 대시보드 로직 (원본 kpi.py 이식).
import { pyRound } from "./py-compat";
import { currentState, type CurrentState, type GeoGoal, type KpiSnapshot } from "./models";

export type KpiProgress = {
  metric: string;
  current: number;
  target: number;
  progressPct: number; // 목표 달성률
  remaining: number;
};

/** asdict(KPIProgress) 재현. */
export function kpiToRow(k: KpiProgress): Record<string, unknown> {
  return { metric: k.metric, current: k.current, target: k.target, progress_pct: k.progressPct, remaining: k.remaining };
}

/** baseline→target 구간에서 current의 달성률(%). */
function progress(current: number, target: number, baseline = 0.0): number {
  const denom = target - baseline;
  if (denom <= 0) return current >= target ? 100.0 : 0.0;
  return pyRound(Math.min(100.0, Math.max(0.0, ((current - baseline) / denom) * 100)), 1);
}

/** 목표 대비 KPI 진척(기획안 6.1 대시보드 4위젯). */
export function kpiProgressRows(goal: GeoGoal, current: CurrentState, baseline?: CurrentState): KpiProgress[] {
  const b = baseline ?? currentState();
  const row = (metric: string, cur: number, isGoal: boolean, base: number): KpiProgress => {
    const target = isGoal ? goal.targetValue : cur;
    const progTarget = isGoal ? goal.targetValue : Math.max(cur, 1);
    return {
      metric,
      current: cur,
      target,
      progressPct: progress(cur, progTarget, base),
      remaining: pyRound(Math.max(0.0, target - cur), 1)
    };
  };
  return [
    row("AI 인용율", current.citationRate, goal.goalType === "citation_rate", b.citationRate),
    row("CEP 커버리지", current.cepCoverage, goal.goalType === "cep_coverage", b.cepCoverage),
    row("Topical Authority", current.taScore, goal.goalType === "ta_score", b.taScore)
  ];
}

export function makeSnapshot(current: CurrentState, estimatedRoi: number, snapshotDate: string): KpiSnapshot {
  return {
    citationRate: current.citationRate,
    cepCoverage: current.cepCoverage,
    taScore: current.taScore,
    estimatedRoi,
    snapshotDate
  };
}

/** asdict(KPISnapshot) 재현. */
export function snapshotToRow(s: KpiSnapshot): Record<string, unknown> {
  return {
    citation_rate: s.citationRate,
    cep_coverage: s.cepCoverage,
    ta_score: s.taScore,
    estimated_roi: s.estimatedRoi,
    snapshot_date: s.snapshotDate
  };
}
