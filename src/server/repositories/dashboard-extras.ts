// 목표 경로: src/server/repositories/dashboard-extras.ts
//
// 대시보드 홈 리디자인용 부가 데이터 — 의료법 위험 콘텐츠 위젯.
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type RiskItem = { id: string; clientName: string; topic: string; high: number; medium: number; topFlag: string | null };

/** 최근 콘텐츠 기획 중 의료법 위험이 감지된 항목. 담당자는 본인 거래처만. */
export async function listComplianceRiskItems(user: CurrentUser): Promise<RiskItem[]> {
  const where = user.role === Role.MARKETER ? { client: { assignedMarketerId: user.id } } : {};
  const rows = await db.contentPlan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, topic: true, complianceRisk: true, client: { select: { name: true } } }
  });
  const items: RiskItem[] = [];
  for (const r of rows) {
    const cr = r.complianceRisk as { high?: number; medium?: number; flags?: { label?: string }[] } | null;
    if (!cr) continue;
    const high = cr.high ?? 0;
    const medium = cr.medium ?? 0;
    if (high + medium === 0) continue;
    items.push({ id: r.id, clientName: r.client.name, topic: r.topic, high, medium, topFlag: cr.flags?.[0]?.label ?? null });
    if (items.length >= 6) break;
  }
  return items;
}
