// 인사관리평가 조회 — 직원 주기별 평가 목록. 쓰기는 actions/hr-evaluation.ts.
import { db } from "@/server/db";

export type HrEvaluationRow = {
  id: string;
  evaluateeId: string;
  evaluateeName: string;
  evaluatorName: string | null;
  period: string;
  performance: number;
  collaboration: number;
  diligence: number;
  expertise: number;
  attitude: number;
  average: number;
  strengths: string | null;
  improvements: string | null;
  comment: string | null;
  updatedAt: string;
};

function avg(e: { performance: number; collaboration: number; diligence: number; expertise: number; attitude: number }) {
  return Math.round(((e.performance + e.collaboration + e.diligence + e.expertise + e.attitude) / 5) * 10) / 10;
}

export async function listHrEvaluations(): Promise<HrEvaluationRow[]> {
  try {
    const rows = await db.hrEvaluation.findMany({ orderBy: [{ period: "desc" }, { updatedAt: "desc" }] });
    if (rows.length === 0) return [];
    const userIds = [...new Set(rows.flatMap((r) => [r.evaluateeId, r.evaluatorId].filter(Boolean) as string[]))];
    const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const nameMap = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      evaluateeId: r.evaluateeId,
      evaluateeName: nameMap.get(r.evaluateeId) ?? "(퇴사/삭제)",
      evaluatorName: r.evaluatorId ? nameMap.get(r.evaluatorId) ?? null : null,
      period: r.period,
      performance: r.performance,
      collaboration: r.collaboration,
      diligence: r.diligence,
      expertise: r.expertise,
      attitude: r.attitude,
      average: avg(r),
      strengths: r.strengths,
      improvements: r.improvements,
      comment: r.comment,
      updatedAt: r.updatedAt.toISOString()
    }));
  } catch {
    // 테이블 미생성 등에도 화면이 죽지 않게.
    return [];
  }
}
