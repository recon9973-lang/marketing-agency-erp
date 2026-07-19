// GEO 실험 장부(학습 A단계) — 순수 도메인 로직.
// "개입(콘텐츠 발행·재작성·키워드 추가 등) → 인용률 변화"를 근거로 남기고,
// 개입 전(baseline)·후(outcome) 실측 인용률로 상승폭(lift)을 계산한다.
// 정직 원칙: outcome은 반드시 실측(GeoCitationScore.mentionRate)에서만 온다(목업 아님).

export const INTERVENTION_KINDS = [
  { key: "CONTENT_PUBLISH", label: "콘텐츠 발행" },
  { key: "CONTENT_REWRITE", label: "콘텐츠 재작성" },
  { key: "KEYWORD_ADD", label: "키워드 추가" },
  { key: "GEO_QUESTION", label: "GEO 질문 추가" },
  { key: "MANUAL", label: "기타(수동)" }
] as const;

export type InterventionKind = (typeof INTERVENTION_KINDS)[number]["key"];

export const interventionKindLabels: Record<string, string> = Object.fromEntries(
  INTERVENTION_KINDS.map((k) => [k.key, k.label])
);

export function isInterventionKind(v: string): v is InterventionKind {
  return INTERVENTION_KINDS.some((k) => k.key === v);
}

/** up=유의한 상승, down=하락, flat=변화 미미(측정 노이즈 대역 안), pending=결과 미측정. */
export type LiftDirection = "up" | "flat" | "down" | "pending";

export type Lift = {
  deltaPoints: number | null; // 인용률 변화(%p, 소수 1자리). pending이면 null
  direction: LiftDirection;
};

/**
 * baseline·outcome(둘 다 0~1 인용률) → 상승폭.
 * band = 유의 대역(기본 5%p). 반복측정·신뢰구간을 감안해 이보다 작은 변화는 flat 처리(과잉해석 방지).
 */
export function computeLift(
  baseline: number | null | undefined,
  outcome: number | null | undefined,
  band = 0.05
): Lift {
  if (baseline == null || outcome == null) return { deltaPoints: null, direction: "pending" };
  const deltaPoints = Math.round((outcome - baseline) * 1000) / 10; // %p, 소수 1자리
  const bandPoints = Math.round(band * 1000) / 10; // 대역도 %p로(부동소수점 경계 안정화)
  if (deltaPoints >= bandPoints) return { deltaPoints, direction: "up" };
  if (deltaPoints <= -bandPoints) return { deltaPoints, direction: "down" };
  return { deltaPoints, direction: "flat" };
}

export type KindSummary = {
  kind: string;
  label: string;
  n: number; // 결과가 측정된 개입 수(pending 제외)
  avgDeltaPoints: number | null; // 평균 변화(%p)
  upRate: number | null; // 상승 비율(0~1)
};

/**
 * 종류별 효과 요약 — 학습의 첫 단계(어떤 개입이 인용률을 올리는 경향인가).
 * pending(결과 미측정)은 제외하고 집계한다. 표본이 작으면 신뢰도 낮음을 호출부가 표기할 것.
 */
export function summarizeByKind(items: Array<{ kind: string; lift: Lift }>): KindSummary[] {
  const byKind = new Map<string, { deltas: number[]; ups: number }>();
  for (const it of items) {
    if (it.lift.direction === "pending" || it.lift.deltaPoints == null) continue;
    const g = byKind.get(it.kind) ?? { deltas: [], ups: 0 };
    g.deltas.push(it.lift.deltaPoints);
    if (it.lift.direction === "up") g.ups += 1;
    byKind.set(it.kind, g);
  }
  return INTERVENTION_KINDS.filter((k) => byKind.has(k.key)).map((k) => {
    const g = byKind.get(k.key)!;
    const n = g.deltas.length;
    const avg = g.deltas.reduce((a, b) => a + b, 0) / n;
    return {
      kind: k.key,
      label: k.label,
      n,
      avgDeltaPoints: Math.round(avg * 10) / 10,
      upRate: Math.round((g.ups / n) * 100) / 100
    };
  });
}
