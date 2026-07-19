// GEO Studio M5 — 저장된 캠페인 계획 조회.
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type SavedGeoPlan = {
  id: string;
  name: string;
  industry: string;
  goalType: string;
  budget: number;
  report: string;
  createdAt: Date;
};

/** 본인이 저장한 계획 목록(최신순, 기본 10건). */
export async function listGeoCampaignPlans(user: CurrentUser, limit = 10): Promise<SavedGeoPlan[]> {
  return db.geoCampaignPlan.findMany({
    where: { createdById: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, name: true, industry: true, goalType: true, budget: true, report: true, createdAt: true }
  });
}
