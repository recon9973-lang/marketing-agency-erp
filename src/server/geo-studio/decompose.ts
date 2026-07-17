// GEO Studio · M5 — 목표 → 실행 태스크 자동 분해 (원본 decompose.py 이식).
import { pyRound, isoAddDays, todayIso } from "./py-compat";
import { DEFAULT_SETTINGS, type Settings } from "./config";
import type { CurrentState, ExecutionTask, GeoGoal } from "./models";

/** 목표 대비 현재 GAP 분석 → 필요한 콘텐츠 수 추정. */
export function analyzeGap(goal: GeoGoal, current: CurrentState): { gap: number; contentNeeded: number } {
  let gap: number;
  let contentNeeded: number;
  if (goal.goalType === "citation_rate") {
    gap = Math.max(0.0, goal.targetValue - current.citationRate);
    contentNeeded = pyRound(gap * 1.5, 0); // 인용율 1%p ≈ 콘텐츠 1.5건
  } else if (goal.goalType === "cep_coverage") {
    gap = Math.max(0.0, goal.targetValue - current.cepCoverage);
    const uncovered = Math.max(0, current.totalCeps - current.coveredCeps);
    contentNeeded = Math.min(uncovered, pyRound((gap / 100) * Math.max(1, current.totalCeps), 0));
  } else if (goal.goalType === "ta_score") {
    gap = Math.max(0.0, goal.targetValue - current.taScore);
    contentNeeded = pyRound(gap / 2, 0); // TA 2점 ≈ 콘텐츠 1건
  } else {
    // roi
    gap = goal.targetValue;
    contentNeeded = goal.budget ? Math.max(4, pyRound(goal.budget / 500000, 0)) : 6;
  }
  return { gap: pyRound(gap, 1), contentNeeded: Math.max(1, contentNeeded) };
}

function makeTask(
  taskType: string,
  title: string,
  dueDate: string,
  assignee: string,
  opts: { status?: string; geoScoreGate?: number; channel?: string; priority?: number } = {}
): ExecutionTask {
  return {
    taskType,
    title,
    dueDate,
    assignee,
    status: opts.status ?? "todo",
    geoScoreGate: opts.geoScoreGate ?? 0,
    channel: opts.channel ?? "",
    priority: opts.priority ?? 3
  };
}

/** 목표를 실행 태스크 큐로 분해한다. 마감일 균등 분배 + 팀 라운드로빈 배정. */
export function decomposeGoal(
  goal: GeoGoal,
  current: CurrentState,
  team?: string[],
  startDate?: string,
  settings: Settings = DEFAULT_SETTINGS
): ExecutionTask[] {
  const roster = team && team.length ? team : Array.from({ length: Math.max(1, goal.teamSize) }, (_, i) => `담당자${i + 1}`);
  const start = startDate ?? todayIso();

  const { contentNeeded: n } = analyzeGap(goal, current);
  const span = Math.max(1, goal.deadlineDays);
  const step = Math.max(1, Math.floor(span / Math.max(1, n)));

  let ai = 0;
  const assignee = () => roster[ai++ % roster.length];

  const gate = settings.geoScoreGate;
  const tasks: ExecutionTask[] = [];
  for (let i = 0; i < n; i++) {
    const baseDay = Math.min(span - 1, i * step);
    const createDue = isoAddDays(start, baseDay);
    const reviewDue = isoAddDays(start, Math.min(span, baseDay + Math.max(1, Math.floor(step / 3))));
    const publishDue = isoAddDays(start, Math.min(span, baseDay + Math.max(2, Math.floor(step / 2))));
    const scanDue = isoAddDays(start, Math.min(span, baseDay + step));
    const title = `콘텐츠 #${i + 1}`;
    tasks.push(makeTask("content_create", `${title} 제작`, createDue, assignee(), { priority: 1 }));
    tasks.push(makeTask("review", `${title} 검토(GEO 게이트)`, reviewDue, assignee(), { geoScoreGate: gate, priority: 2 }));
    tasks.push(makeTask("content_publish", `${title} 발행`, publishDue, assignee(), { geoScoreGate: gate, priority: 2 }));
    tasks.push(makeTask("scan", `${title} 인용율 스캔`, scanDue, assignee(), { priority: 3 }));
  }
  return tasks;
}
