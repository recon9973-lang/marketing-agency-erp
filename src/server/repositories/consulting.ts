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

/** 리드의 최신 컨설팅 리포트(계약 前 생성분). 없으면 null. 권한은 호출부에서 확인. */
export async function getLeadConsulting(leadId: string): Promise<ConsultingReportView> {
  const r = await db.consultingReport.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" } });
  return r ? mapReport(r) : null;
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
