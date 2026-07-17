// GEO Studio · M5 채널 플래너 — 도메인 모델 (원본 geo_channel_planner/models.py 이식).
// 도메인 타입은 camelCase(ERP 관례), toRow()는 파이썬 asdict/to_row의 snake_case 페이로드를 재현.

export const GOAL_TYPES = ["citation_rate", "cep_coverage", "ta_score", "roi"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
export const TASK_TYPES = ["content_create", "content_publish", "scan", "review"] as const;
export const TASK_STATUS = ["todo", "in_progress", "review", "done"] as const;
export const CHANNELS = ["blog", "youtube", "naver", "press", "sns", "reddit", "wiki"] as const;

export type GeoGoal = {
  goalType: string; // citation_rate / cep_coverage / ta_score / roi
  targetValue: number;
  deadlineDays: number;
  budget: number; // 원
  teamSize: number;
};

export type CurrentState = {
  citationRate: number;
  cepCoverage: number;
  taScore: number;
  totalCeps: number;
  coveredCeps: number;
};

/** CurrentState 기본값(원본 dataclass 기본값). */
export function currentState(p: Partial<CurrentState> = {}): CurrentState {
  return { citationRate: 0, cepCoverage: 0, taScore: 0, totalCeps: 0, coveredCeps: 0, ...p };
}

export type ExecutionTask = {
  taskType: string;
  title: string;
  dueDate: string; // ISO date
  assignee: string;
  status: string;
  geoScoreGate: number;
  channel: string;
  priority: number;
};

export function taskToRow(t: ExecutionTask): Record<string, unknown> {
  return {
    task_type: t.taskType,
    title: t.title,
    due_date: t.dueDate,
    assignee: t.assignee,
    status: t.status,
    geo_score_gate: t.geoScoreGate,
    channel: t.channel,
    priority: t.priority
  };
}

export type ChannelAllocation = {
  channel: string;
  budgetPct: number;
  budgetAllocation: number;
  contentCount: number;
  contentTypes: string[];
  expectedCitationBoost: number; // %p
};

export function allocationToRow(a: ChannelAllocation): Record<string, unknown> {
  return {
    channel: a.channel,
    budget_pct: a.budgetPct,
    budget_allocation: a.budgetAllocation,
    content_count: a.contentCount,
    content_types: a.contentTypes,
    expected_citation_boost: a.expectedCitationBoost
  };
}

export type ChannelMix = {
  allocations: ChannelAllocation[];
  totalExpectedCitationBoost: number;
  estimatedRoi: number;
};

export function channelMixToRow(m: ChannelMix): Record<string, unknown> {
  return {
    recommended_mix: m.allocations.map(allocationToRow),
    total_expected_citation_boost: m.totalExpectedCitationBoost,
    estimated_roi: m.estimatedRoi
  };
}

export type KpiSnapshot = {
  citationRate: number;
  cepCoverage: number;
  taScore: number;
  estimatedRoi: number;
  snapshotDate: string;
};

export type Campaign = {
  name: string;
  goal: GeoGoal;
  startDate: string;
  endDate: string;
  status: string;
  tasks: ExecutionTask[];
  channelMix: ChannelMix | null;
};
