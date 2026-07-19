// GEO 실험 장부 리포지토리 — 개입 기록 + 실측 인용률 결합(학습 A단계).
// baseline은 기록 시 스냅샷(그때의 진실), outcome은 읽을 때 실측 시계열에서 동적 계산
// (새 측정이 쌓이면 자동 갱신). 정답 신호는 GeoCitationScore.mentionRate(실측)만 사용.
import { db } from "@/server/db";
import { computeLift, summarizeByKind, type Lift } from "@/domain/geo/intervention";

// 개입 후 이 일수가 지난 첫 측정치를 결과로 본다(즉시 반영되지 않으므로 관측 지연 반영).
const OUTCOME_LAG_DAYS = 7;
const DAY_MS = 86_400_000;

/** 특정 시각 이전 최근 거래처 전체(questionId=null) 인용률 — 개입 baseline 스냅샷용. */
export async function getBaselineRate(clientId: string, at: Date): Promise<number | null> {
  const s = await db.geoCitationScore.findFirst({
    where: { clientId, questionId: null, runAt: { lte: at } },
    orderBy: { runAt: "desc" },
    select: { mentionRate: true }
  });
  return s?.mentionRate ?? null;
}

export type InterventionRow = {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  occurredAt: string; // ISO
  baselineRate: number | null;
  outcomeRate: number | null;
  outcomeAt: string | null; // ISO(측정일)
  lift: Lift;
};

export type InterventionLedger = {
  rows: InterventionRow[];
  summary: ReturnType<typeof summarizeByKind>;
  resolved: number; // 결과가 측정된 개입 수
  pending: number; // 결과 대기 중
};

/** 거래처 실험 장부 — 개입별 baseline·outcome·lift + 종류별 효과 요약. 권한은 호출부에서 확인. */
export async function getInterventionLedger(clientId: string): Promise<InterventionLedger> {
  const [items, scores] = await Promise.all([
    db.geoIntervention.findMany({
      where: { clientId },
      orderBy: { occurredAt: "desc" },
      select: { id: true, kind: true, title: true, detail: true, occurredAt: true, baselineRate: true }
    }),
    db.geoCitationScore.findMany({
      where: { clientId, questionId: null },
      orderBy: { runAt: "asc" },
      select: { runAt: true, mentionRate: true }
    })
  ]);

  const rows: InterventionRow[] = items.map((it) => {
    const lagDate = new Date(it.occurredAt.getTime() + OUTCOME_LAG_DAYS * DAY_MS);
    // 개입+지연 이후 첫 측정. 없으면 개입 이후 아무 측정(있으면)으로 근사.
    const after =
      scores.find((s) => s.runAt >= lagDate) ?? scores.find((s) => s.runAt > it.occurredAt) ?? null;
    const outcomeRate = after?.mentionRate ?? null;
    const lift = computeLift(it.baselineRate, outcomeRate);
    return {
      id: it.id,
      kind: it.kind,
      title: it.title,
      detail: it.detail,
      occurredAt: it.occurredAt.toISOString(),
      baselineRate: it.baselineRate,
      outcomeRate,
      outcomeAt: after ? after.runAt.toISOString() : null,
      lift
    };
  });

  const resolved = rows.filter((r) => r.lift.direction !== "pending").length;
  return {
    rows,
    summary: summarizeByKind(rows.map((r) => ({ kind: r.kind, lift: r.lift }))),
    resolved,
    pending: rows.length - resolved
  };
}
