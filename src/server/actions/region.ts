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
  type RegionResolve,
  type RegionPopulation,
  type HospitalSummary,
  type DemandRow
} from "@/server/data/region-insight";

export type RegionAnalysis = {
  resolve: RegionResolve;
  population: RegionPopulation | null;
  hospitals: HospitalSummary | null;
  specialty: string | null;
  demand: DemandRow[];
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
    return { resolve, population, hospitals, specialty, demand };
  });
}
