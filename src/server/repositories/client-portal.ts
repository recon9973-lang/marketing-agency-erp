// 목표 경로: src/server/repositories/client-portal.ts
//
// 거래처 포털 공개 조회 — portalToken으로만 접근. 화이트리스트 필드만 노출(내부 데이터 차단).
import { db } from "@/server/db";

export type PortalReport = { id: string; title: string; month: string; summary: string; keywordRanks: { keyword: string; rank: number | null }[] };
export type PortalPlan = { id: string; month: string; topic: string; angle: string | null; faq: string[]; qa: { q: string; a: string }[] };
export type ClientPortal = {
  clientName: string;
  reports: PortalReport[];
  reviewPlans: PortalPlan[];
} | null;

const monthFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });

export async function getClientPortal(token: string): Promise<ClientPortal> {
  const client = await db.client.findUnique({ where: { portalToken: token }, select: { id: true, name: true } });
  if (!client) return null;

  const [reports, plans] = await Promise.all([
    db.report.findMany({
      where: { clientId: client.id, status: { in: ["APPROVED", "DELIVERED"] } },
      orderBy: { reportingMonth: "desc" },
      take: 24,
      select: { id: true, title: true, reportingMonth: true, metrics: true }
    }),
    db.contentPlan.findMany({
      where: { clientId: client.id, status: "REVIEWED" },
      orderBy: { createdAt: "desc" },
      // 화이트리스트: complianceRisk 등 내부 필드 제외.
      select: { id: true, month: true, topic: true, angle: true, faq: true, qa: true }
    })
  ]);

  return {
    clientName: client.name,
    reports: reports.map((r) => {
      const m = (r.metrics as Record<string, unknown> | null) ?? {};
      const ranks = Array.isArray((m as { keywordRanks?: unknown }).keywordRanks)
        ? ((m as { keywordRanks: { keyword: string; rank: number | null }[] }).keywordRanks)
        : [];
      return { id: r.id, title: r.title, month: monthFmt.format(r.reportingMonth), summary: String((m as { summary?: string }).summary ?? ""), keywordRanks: ranks };
    }),
    reviewPlans: plans.map((p) => ({
      id: p.id,
      month: p.month,
      topic: p.topic,
      angle: p.angle,
      faq: Array.isArray(p.faq) ? (p.faq as unknown as string[]) : [],
      qa: Array.isArray(p.qa) ? (p.qa as unknown as { q: string; a: string }[]) : []
    }))
  };
}
