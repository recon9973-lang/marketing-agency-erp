"use server";

/**
 * 상권분석 저장 리포트 — 분석 결과를 ConsultingReport(track="market")로 남겨 재조회.
 * 마케팅 전략 저장(strategy.ts)과 동일 패턴·동일 모델을 쓰되 track 컬럼으로 트랙 분리.
 *   · 전략 저장분 = clientId·leadId null + track≠"market"(레거시 null 포함)
 *   · 상권 저장분 = clientId·leadId null + track="market"
 * 상권분석은 브리프 문자열이 없으므로 buildMarketReport 마크다운을 생성해 저장한다.
 */
import { Prisma } from "@prisma/client";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireUser } from "@/server/actions/_helpers";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { getLocationInsight } from "@/server/data/region-insight";
import { buildScorecard } from "@/server/market/scorecard";
import { getOpenings, nationalHospitalsPerTenThousand } from "@/server/data/region-insight";
import { buildMarketReport } from "@/server/market/report";

export type MarketReportListItem = {
  id: string;
  hospitalName: string;
  address: string | null;
  departments: string | null;
  summary: string | null;
  status: string;
  createdAt: string;
};
export type MarketReportFull = MarketReportListItem & { markdown: string | null };

/** 상권분석 저장 리포트 최근 목록(track="market"). */
export async function listMarketReports(limit = 20): Promise<ActionResult<MarketReportListItem[]>> {
  return runAction(async (): Promise<MarketReportListItem[]> => {
    await requireUser();
    const orgId = await getDefaultOrgId();
    const rows = await db.consultingReport.findMany({
      where: { clientId: null, leadId: null, orgId, track: "market" },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
      select: { id: true, hospitalName: true, address: true, departments: true, summary: true, status: true, createdAt: true }
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  });
}

/** 저장된 상권분석 리포트 상세(리포트 마크다운 전문). */
export async function getMarketReport(id: string): Promise<ActionResult<MarketReportFull>> {
  return runAction(async (): Promise<MarketReportFull> => {
    await requireUser();
    const orgId = await getDefaultOrgId();
    const r = await db.consultingReport.findFirst({
      where: { id: id.trim(), orgId, track: "market" },
      select: { id: true, hospitalName: true, address: true, departments: true, summary: true, status: true, createdAt: true, marketAnalysis: true }
    });
    if (!r) throw new Error("리포트를 찾을 수 없습니다.");
    return {
      id: r.id, hospitalName: r.hospitalName, address: r.address, departments: r.departments,
      summary: r.summary, status: r.status, createdAt: r.createdAt.toISOString(), markdown: r.marketAnalysis
    };
  });
}

/** 상권 저장 리포트 상태 전환(DRAFT↔SHARED). 상권 저장분(track="market")만. */
export async function updateMarketReportStatus(id: string, status: "DRAFT" | "SHARED"): Promise<ActionResult<{ ok: true }>> {
  return runAction(async (): Promise<{ ok: true }> => {
    await requireUser();
    const orgId = await getDefaultOrgId();
    const r = await db.consultingReport.updateMany({
      where: { id: id.trim(), orgId, clientId: null, leadId: null, track: "market" },
      data: { status }
    });
    if (r.count === 0) throw new Error("리포트를 찾을 수 없습니다.");
    return { ok: true as const };
  });
}

/** 상권 저장 리포트 삭제. 상권 저장분(track="market")만 — 전략/리드/거래처 컨설팅은 보호. */
export async function deleteMarketReport(id: string): Promise<ActionResult<{ ok: true }>> {
  return runAction(async (): Promise<{ ok: true }> => {
    await requireUser();
    const orgId = await getDefaultOrgId();
    const r = await db.consultingReport.deleteMany({
      where: { id: id.trim(), orgId, clientId: null, leadId: null, track: "market" }
    });
    if (r.count === 0) throw new Error("리포트를 찾을 수 없습니다.");
    return { ok: true as const };
  });
}

/**
 * 상권분석 결과를 저장 리포트로 남긴다. region(+specialty+brand)로 서버에서 리포트 마크다운을
 * 재생성해 저장(전략의 brief 저장과 대칭). 스코어카드 등급/점수를 요약으로.
 */
export async function saveMarketReport(input: {
  region: string;
  specialty?: string | null;
  brand?: string | null;
  leadId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async (): Promise<{ id: string }> => {
    const user = await requireUser();
    const region = (input.region ?? "").trim();
    if (!region) throw new Error("지역이 없어 저장할 수 없습니다.");
    const specialty = input.specialty?.trim() || null;
    const brand = input.brand?.trim() || null;

    const { resolve, population, hospitals } = getLocationInsight(region);
    if (!resolve.key) throw new Error("지역을 특정하지 못해 저장할 수 없습니다(구·동까지 입력).");

    const report = buildMarketReport(region, specialty, brand);
    const markdown = report.ok ? report.markdown : "";
    if (!markdown) throw new Error("리포트 생성에 실패했습니다.");

    // 요약 = 종합 스코어카드 등급/점수(있으면).
    const sc = buildScorecard({
      population, hospitals,
      openings: getOpenings(resolve.key),
      nationalPer: nationalHospitalsPerTenThousand()
    });
    const summary = sc ? `종합 ${sc.grade}등급 (${sc.overall}/100)` : null;

    const orgId = await getDefaultOrgId();
    const saved = await db.consultingReport.create({
      data: {
        authorId: user.id,
        leadId: input.leadId?.trim() || null, // 리드에서 실행 시 그 리드에 귀속
        hospitalName: brand || resolve.label,
        address: resolve.label,
        departments: specialty,
        marketAnalysis: markdown,
        summary,
        competitors: Prisma.JsonNull,
        track: "market",
        status: "DRAFT",
        orgId
      }
    });
    return { id: saved.id };
  });
}
