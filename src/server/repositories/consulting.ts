// 목표 경로: src/server/repositories/consulting.ts
//
// 컨설팅 리포트 조회. 권한은 호출부(거래처 접근)에서 확인.
import { db } from "@/server/db";

export type ConsultingKeywordRow = { keyword: string; intent: string; priority: number; channel: string; searchVolume?: number | null; estimated?: boolean };
export type ConsultingReportView = {
  id: string;
  hospitalName: string;
  address: string | null;
  departments: string | null;
  keywords: ConsultingKeywordRow[];
  competitors: string | null;
  marketAnalysis: string | null;
  summary: string | null;
  status: string;
  createdAt: string;
} | null;

function mapReport(r: {
  id: string;
  hospitalName: string;
  address: string | null;
  departments: string | null;
  keywords: unknown;
  competitors: unknown;
  marketAnalysis: string | null;
  summary: string | null;
  status: string;
  createdAt: Date;
}): NonNullable<ConsultingReportView> {
  const kw = Array.isArray(r.keywords) ? (r.keywords as unknown as ConsultingKeywordRow[]) : [];
  return {
    id: r.id,
    hospitalName: r.hospitalName,
    address: r.address,
    departments: r.departments,
    keywords: kw,
    competitors: typeof r.competitors === "string" ? r.competitors : null,
    marketAnalysis: r.marketAnalysis,
    summary: r.summary,
    status: r.status,
    createdAt: r.createdAt.toISOString()
  };
}

/** 리드의 최신 컨설팅 리포트(계약 前 Claude 생성분). track=null만 — 상권/전략 저장분은 별도. */
export async function getLeadConsulting(leadId: string): Promise<ConsultingReportView> {
  const r = await db.consultingReport.findFirst({ where: { leadId, track: null }, orderBy: { createdAt: "desc" } });
  return r ? mapReport(r) : null;
}

export type LeadAnalysisRow = { id: string; track: string; title: string; departments: string | null; summary: string | null; markdown: string | null; createdAt: string };

/** 리드에 귀속된 상권분석·마케팅 전략 저장 분석 목록(track in market/strategy). */
export async function listLeadAnalyses(leadId: string): Promise<LeadAnalysisRow[]> {
  const rows = await db.consultingReport.findMany({
    where: { leadId, track: { in: ["market", "strategy"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, track: true, hospitalName: true, departments: true, summary: true, marketAnalysis: true, createdAt: true }
  });
  return rows.map((r) => ({
    id: r.id,
    track: r.track ?? "",
    title: r.hospitalName,
    departments: r.departments,
    summary: r.summary,
    markdown: r.marketAnalysis,
    createdAt: r.createdAt.toISOString()
  }));
}

/** 거래처의 최신 컨설팅 리포트. 없으면 null. */
export async function getLatestConsulting(clientId: string): Promise<ConsultingReportView> {
  const r = await db.consultingReport.findFirst({
    where: { clientId },
    orderBy: { createdAt: "desc" }
  });
  if (!r) return null;
  const kw = Array.isArray(r.keywords) ? (r.keywords as unknown as ConsultingKeywordRow[]) : [];
  return {
    id: r.id,
    hospitalName: r.hospitalName,
    address: r.address,
    departments: r.departments,
    keywords: kw,
    competitors: typeof r.competitors === "string" ? r.competitors : null,
    marketAnalysis: r.marketAnalysis,
    summary: r.summary,
    status: r.status,
    createdAt: r.createdAt.toISOString()
  };
}
