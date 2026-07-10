// 목표 경로: src/server/repositories/content-plans.ts
//
// 콘텐츠 기획 조회. 권한은 호출부(거래처 접근)에서.
import { db } from "@/server/db";

export type ComplianceRiskView = { high: number; medium: number; flags: { label: string; matched: string; code: number; severity: string }[] };
export type ContentPlanView = {
  id: string;
  month: string;
  topic: string;
  keyword: string | null;
  angle: string | null;
  faq: string[];
  qa: { q: string; a: string }[];
  complianceRisk: ComplianceRiskView | null;
  status: string;
  createdAt: string;
};

export async function listContentPlans(clientId: string): Promise<ContentPlanView[]> {
  const rows = await db.contentPlan.findMany({
    where: { clientId },
    orderBy: [{ month: "desc" }, { createdAt: "desc" }]
  });
  return rows.map((r) => ({
    id: r.id,
    month: r.month,
    topic: r.topic,
    keyword: r.keyword,
    angle: r.angle,
    faq: Array.isArray(r.faq) ? (r.faq as unknown as string[]) : [],
    qa: Array.isArray(r.qa) ? (r.qa as unknown as { q: string; a: string }[]) : [],
    complianceRisk: r.complianceRisk ? (r.complianceRisk as unknown as ComplianceRiskView) : null,
    status: r.status,
    createdAt: r.createdAt.toISOString()
  }));
}
