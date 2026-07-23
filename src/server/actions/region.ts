"use server";

/**
 * 상권분석 — 지역(시군구) 실측 인사이트 server action.
 * 행안부(인구·성별·증감) + 심평원(병원 밀집도·종별, 표시과목별 수요) 오프라인 데이터셋 질의.
 * 로그인한 직원 누구나 조회. (location-auto 스킬 ①②③축의 ERP 상시 실측 소스)
 */
import { runAction, type ActionResult } from "@/server/action-result";
import { requireUser } from "@/server/actions/_helpers";
import {
  getLocationInsight,
  getDemandBySpecialty,
  radiusForFacility,
  nationalHospitalsPerTenThousand,
  type RegionResolve,
  type RegionPopulation,
  type HospitalSummary,
  type DemandRow,
  type FacilityRadius
} from "@/server/data/region-insight";
import { buildMarketReport, buildProposal, type MarketReport } from "@/server/market/report";
import { searchLocalPlaces, naverLocalConfigured, type LocalPlace } from "@/server/integrations/naver-local";
import { isAiConfigured, generateMarketNarrative } from "@/server/ai/claude";

/** 리포트/제안서 마크다운에 AI 심층 분석을 덧붙인다(키 있을 때·실패 시 원본 유지). */
async function withAiNarrative(report: MarketReport): Promise<MarketReport> {
  if (!report.ok || !report.markdown || !isAiConfigured()) return report;
  try {
    const ai = await generateMarketNarrative(report.markdown);
    if (ai) report.markdown += `\n\n## AI 심층 분석\n${ai}\n`;
  } catch {
    // AI 실패는 무시 — 결정형 리포트는 그대로 유효.
  }
  return report;
}

export type RegionAnalysis = {
  resolve: RegionResolve;
  population: RegionPopulation | null;
  hospitals: HospitalSummary | null;
  specialty: string | null;
  demand: DemandRow[];
  nationalPer: number; // 전국 인구 만명당 병·의원 수(경쟁강도 기준선)
};

export async function analyzeRegion(input: {
  region: string;
  specialty?: string | null;
}): Promise<ActionResult<RegionAnalysis>> {
  return runAction(async (): Promise<RegionAnalysis> => {
    await requireUser();
    const region = (input.region ?? "").trim();
    const { resolve, population, hospitals } = getLocationInsight(region);
    const specialty = input.specialty?.trim() || null;
    const demand = specialty ? getDemandBySpecialty(specialty) : [];
    return { resolve, population, hospitals, specialty, demand, nationalPer: nationalHospitalsPerTenThousand() };
  });
}

/** 지역+진료과 → 상권분석 리포트(마크다운) 생성. 내장 실측 데이터 기반(날조 없음). */
export async function generateMarketReport(input: {
  region: string;
  specialty?: string | null;
  brand?: string | null;
}): Promise<ActionResult<MarketReport>> {
  return runAction(async (): Promise<MarketReport> => {
    await requireUser();
    return withAiNarrative(buildMarketReport((input.region ?? "").trim(), input.specialty?.trim() || null, input.brand?.trim() || null));
  });
}

/** 지역+진료과 → 네이버 지역검색 경쟁사 상위 표본(최대 5). 미연결 시 configured=false. */
export async function searchCompetitors(input: {
  region: string;
  specialty?: string | null;
}): Promise<ActionResult<{ configured: boolean; query: string; places: LocalPlace[] }>> {
  return runAction(async () => {
    await requireUser();
    const { resolve } = getLocationInsight((input.region ?? "").trim());
    const label = resolve.key ? resolve.label : (input.region ?? "").trim();
    const q = `${label} ${input.specialty?.trim() || ""}`.trim();
    const places = await searchLocalPlaces(q, 5);
    return { configured: naverLocalConfigured(), query: q, places };
  });
}

/** 업체명+지역 → 좌표 매칭 → 반경 밀집도(동종 경쟁·전체). 지오코딩 불필요. */
export async function analyzeRadius(input: {
  region: string;
  name: string;
  radiusKm?: number;
}): Promise<ActionResult<FacilityRadius>> {
  return runAction(async (): Promise<FacilityRadius> => {
    await requireUser();
    return radiusForFacility((input.region ?? "").trim(), (input.name ?? "").trim(), input.radiusKm ?? 1);
  });
}

/** 지역+진료과+업체명 → 마케팅 제안서(마크다운) 생성. */
export async function generateProposal(input: {
  region: string;
  specialty?: string | null;
  brand?: string | null;
  monthlyBudget?: number;
}): Promise<ActionResult<MarketReport>> {
  return runAction(async (): Promise<MarketReport> => {
    await requireUser();
    return withAiNarrative(
      buildProposal(
        (input.region ?? "").trim(),
        input.specialty?.trim() || null,
        input.brand?.trim() || null,
        input.monthlyBudget ?? 200
      )
    );
  });
}
