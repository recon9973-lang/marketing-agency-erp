// src/server/repositories/risk.ts
//
// 리스크 조회 헬퍼 — 대시보드 노출·게이트에 사용.
import { db } from "@/server/db";
import { OPEN_RISK_STATUSES } from "@/domain/sales/risk";

/** 거래처의 미해소 리스크 건수. */
export async function openRiskCount(clientId: string): Promise<number> {
  return db.riskLog.count({ where: { clientId, status: { in: OPEN_RISK_STATUSES } } });
}

/** 거래처의 미해소 리스크 점수 합(대표 대시보드 계정 리스크 점수). */
export async function openRiskScore(clientId: string): Promise<number> {
  const rows = await db.riskLog.findMany({
    where: { clientId, status: { in: OPEN_RISK_STATUSES } },
    select: { score: true }
  });
  return rows.reduce((s, r) => s + r.score, 0);
}

/** 특정 소스(예: WorkItem)에 미해소 리스크가 있는지 — "해소 전 완료 불가" 게이트용. */
export async function hasOpenRiskFor(sourceType: string, sourceId: string): Promise<boolean> {
  const r = await db.riskLog.findFirst({
    where: { sourceType, sourceId, status: { in: OPEN_RISK_STATUSES } },
    select: { id: true }
  });
  return Boolean(r);
}
