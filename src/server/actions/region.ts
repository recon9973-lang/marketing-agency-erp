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
    return buildMarketReport((input.region ?? "").trim(), input.specialty?.trim() || null, input.brand?.trim() || null);
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
    return buildProposal(
      (input.region ?? "").trim(),
      input.specialty?.trim() || null,
      input.brand?.trim() || null,
      input.monthlyBudget ?? 200
    );
  });
}
