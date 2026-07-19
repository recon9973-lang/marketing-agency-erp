// GEO 언급률 집계 — 순수 함수(외부 의존 없음, 유닛테스트 대상).
// GEO 모듈 설계 §2~3: 원천 GeoAnswerRecord(질문×엔진×일자)를 일별/실행 단위로 집계해
// 언급률 시계열·엔진 분포·평균순위를 만든다. 측정 반복은 majorityAppeared로 다수결 확정.

/** 한 엔진 관측 — 반복 호출을 다수결로 접은 뒤의 확정값. */
export type EngineObservation = {
  engine: string;
  appeared: boolean;
  cited: boolean;
  rank: number | null; // 답변 내 우리 병원 등장 순위(1=최상단)
};

export type CitationAgg = {
  totalModels: number; // 분모: 관측 대상 엔진 수
  mentionedModels: number; // 분자: 언급된 엔진 수
  mentionRate: number; // 0~1
  citedModels: number; // 공식 URL 인용 엔진 수
  avgRank: number | null; // 언급 시 평균 등장 순위(언급 0이면 null)
  byEngine: Record<string, { mentioned: boolean; cited: boolean; rank: number | null }>;
};

/**
 * 권장 반복 횟수 — GEO 문헌(Schulte "Don't Measure Once", Sielinski) 기준.
 * 브랜드 노출 표준오차<0.10을 위해 질문×엔진당 하루 ≥7회, 출처 커버리지엔 ≥8회. 단일 실행은 통계적으로 불신.
 */
export const RECOMMENDED_RUNS = 7;

/**
 * 측정 반복 다수결 — 같은 질문×엔진을 N회 호출한 출현 관측을 하나로 접는다(요약 표시용).
 * LLM 답변은 실행마다 변하므로 과반 등장 시에만 appeared=true(정직·보수적: 동수는 false).
 * ⚠ 문헌 권고: 다수결로 접기 전에 원시 N회를 보존하고, 표시는 비율+신뢰구간(mentionRateCI)으로.
 */
export function majorityAppeared(observations: boolean[]): boolean {
  if (observations.length === 0) return false;
  const yes = observations.filter(Boolean).length;
  return yes > observations.length / 2;
}

/**
 * 언급률 신뢰구간(Wilson 95%) — "단일 측정값이 아니라 분포로" 원칙 구현.
 * 반복·표본이 적을수록 넓은 구간 → 저신뢰 추정을 정직하게 표시. success/total(0~1) 반환.
 */
export function mentionRateCI(success: number, total: number): { rate: number; low: number; high: number } {
  if (total <= 0) return { rate: 0, low: 0, high: 0 };
  const z = 1.96;
  const p = success / total;
  const denom = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  const low = Math.max(0, (center - margin) / denom);
  const high = Math.min(1, (center + margin) / denom);
  return { rate: p, low, high };
}

/** 한 실행(run)의 엔진별 관측 → 언급률·평균순위·엔진분포 집계. 엔진 중복 시 첫 값 유지(호출부가 최신 전달). */
export function aggregateRun(observations: EngineObservation[]): CitationAgg {
  const byEngine: CitationAgg["byEngine"] = {};
  for (const o of observations) {
    if (o.engine in byEngine) continue; // 엔진당 1건
    byEngine[o.engine] = { mentioned: o.appeared, cited: o.cited, rank: o.rank };
  }
  const engines = Object.values(byEngine);
  const totalModels = engines.length;
  const mentionedModels = engines.filter((e) => e.mentioned).length;
  const citedModels = engines.filter((e) => e.cited).length;
  const ranks = engines.filter((e) => e.mentioned && typeof e.rank === "number").map((e) => e.rank as number);
  const avgRank = ranks.length ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10 : null;
  return {
    totalModels,
    mentionedModels,
    mentionRate: totalModels > 0 ? mentionedModels / totalModels : 0,
    citedModels,
    avgRank,
    byEngine
  };
}

/** 일별 관측 셀 — 질문×엔진×일자 단위 원천. */
export type DatedCell = { checkedOn: string; engine: string; appeared: boolean };

export type MentionRatePoint = {
  date: string; // YYYY-MM-DD
  total: number; // 그날 관측 셀 수(분모)
  mentioned: number; // 언급 셀 수(분자)
  rate: number; // 0~100 (%) — 그래프용 정수 퍼센트
};

/**
 * 전체 언급률 일별 시계열(B1 북극성 그래프 데이터).
 * 그날의 모든 질문×엔진 셀 중 언급 비율. 날짜 오름차순, 관측 없는 날은 생략.
 */
export function dailyMentionSeries(cells: DatedCell[]): MentionRatePoint[] {
  const byDate = new Map<string, { total: number; mentioned: number }>();
  for (const c of cells) {
    const slot = byDate.get(c.checkedOn) ?? { total: 0, mentioned: 0 };
    slot.total += 1;
    if (c.appeared) slot.mentioned += 1;
    byDate.set(c.checkedOn, slot);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({
      date,
      total: s.total,
      mentioned: s.mentioned,
      rate: s.total > 0 ? Math.round((s.mentioned / s.total) * 100) : 0
    }));
}
