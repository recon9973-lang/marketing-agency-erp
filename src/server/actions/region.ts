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
  getOrientalDemand,
  getFrequentDiseases,
  getOpenings,
  getProvinceDemand,
  getDiseaseDemographics,
  radiusForFacility,
  nationalHospitalsPerTenThousand,
  type RegionResolve,
  type RegionPopulation,
  type HospitalSummary,
  type DemandRow,
  type FacilityRadius,
  type OrientalDemand,
  type FrequentDisease,
  type Openings,
  type ProvinceRow,
  type DiseaseDemo
} from "@/server/data/region-insight";

const ORIENTAL_SPECIALTIES = new Set(["한의원", "한방병원", "한방"]);
import { buildMarketReport, buildProposal, type MarketReport, type ReportExtra } from "@/server/market/report";
import { searchLocalPlaces, naverLocalConfigured, type LocalPlace } from "@/server/integrations/naver-local";
import { resolveAdmCode, fetchRegionDemographics } from "@/server/integrations/sgis";
import { isAiConfigured, generateMarketNarrative } from "@/server/ai/claude";

/** 진료과 동종 필터를 적용한 경쟁사 상위 표본. */
async function fetchCompetitors(label: string, specialty: string | null): Promise<LocalPlace[]> {
  const q = `${label} ${specialty || ""}`.trim();
  const raw = await searchLocalPlaces(q, 5).catch(() => []);
  if (specialty) {
    const term = specialty.replace(/\s+/g, "");
    const same = raw.filter((p) => `${p.category}${p.name}`.replace(/\s+/g, "").includes(term));
    if (same.length > 0) return same;
  }
  return raw;
}

/** 문서 생성에 연결된 실측 소스(네이버 경쟁사 · SGIS 연령·성별)를 모은다(모두 best-effort). */
async function gatherReportExtra(label: string, specialty: string | null): Promise<ReportExtra> {
  const [competitors, demographics] = await Promise.all([
    fetchCompetitors(label, specialty),
    (async () => {
      const adm = await resolveAdmCode(label).catch(() => null);
      return adm ? await fetchRegionDemographics(adm.admCd).catch(() => null) : null;
    })()
  ]);
  return { competitors, demographics };
}

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
  orientalDemand: OrientalDemand | null; // 한방 진료과 선택 시 지역 한방 주상병 수요
  frequent: { kind: string; latest: number; prev2: number; rows: FrequentDisease[] }; // 전국 다빈도 3년 추이
  openings: Openings | null; // 최근 개원 추세(경쟁 심화 신호)
  province: { sido: string; rows: ProvinceRow[] }; // 양방 시도별 다빈도 상병
  demoMap: Record<string, DiseaseDemo>; // 상병(3단)별 성별×연령 타깃
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
    const orientalDemand =
      specialty && ORIENTAL_SPECIALTIES.has(specialty) && resolve.key ? getOrientalDemand(resolve.key) : null;
    const fk = specialty && ORIENTAL_SPECIALTIES.has(specialty) ? "한방" : "전체";
    const fq = getFrequentDiseases(fk);
    const frequent = { kind: fk, latest: fq.years.latest, prev2: fq.years.prev2, rows: fq.rows };
    const openings = resolve.key ? getOpenings(resolve.key) : null;
    const sido = resolve.key ? resolve.key.split("|")[0] : "";
    const province = { sido, rows: getProvinceDemand(sido) };
    const demoMap: Record<string, DiseaseDemo> = {};
    const codes = new Set<string>();
    demand.forEach((d) => codes.add(d.code.slice(0, 3)));
    fq.rows.forEach((r) => codes.add(r.code.slice(0, 3)));
    province.rows.forEach((r) => codes.add(r.code.slice(0, 3)));
    codes.forEach((c) => {
      const d = getDiseaseDemographics(c);
      if (d) demoMap[c] = d;
    });
    return { resolve, population, hospitals, specialty, demand, orientalDemand, frequent, openings, province, demoMap, nationalPer: nationalHospitalsPerTenThousand() };
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
    const region = (input.region ?? "").trim();
    const specialty = input.specialty?.trim() || null;
    const brand = input.brand?.trim() || null;
    const { resolve } = getLocationInsight(region);
    if (!resolve.key) return buildMarketReport(region, specialty, brand);
    const extra = await gatherReportExtra(resolve.label, specialty);
    return withAiNarrative(buildMarketReport(region, specialty, brand, extra));
  });
}

/** 지역+진료과 → 네이버 지역검색 경쟁사 상위 표본(최대 5). 미연결 시 configured=false. */
export async function searchCompetitors(input: {
  region: string;
  specialty?: string | null;
}): Promise<ActionResult<{ configured: boolean; query: string; places: LocalPlace[]; filtered: boolean }>> {
  return runAction(async () => {
    await requireUser();
    const { resolve } = getLocationInsight((input.region ?? "").trim());
    const label = resolve.key ? resolve.label : (input.region ?? "").trim();
    const specialty = input.specialty?.trim() || "";
    const q = `${label} ${specialty}`.trim();
    const raw = await searchLocalPlaces(q, 5);
    // 동종 필터: 진료과가 있으면 category/상호에 그 진료과가 들어간 곳만(요양병원 등 이종 제거).
    // 필터 결과가 없으면 전체 표본으로 폴백.
    let places = raw;
    if (specialty) {
      const term = specialty.replace(/\s+/g, "");
      const same = raw.filter((p) => `${p.category}${p.name}`.replace(/\s+/g, "").includes(term));
      if (same.length > 0) places = same;
    }
    return { configured: naverLocalConfigured(), query: q, places, filtered: specialty ? places.length < raw.length : false };
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
    const region = (input.region ?? "").trim();
    const specialty = input.specialty?.trim() || null;
    const brand = input.brand?.trim() || null;
    const { resolve } = getLocationInsight(region);
    if (!resolve.key) return buildProposal(region, specialty, brand, input.monthlyBudget ?? 200);
    const extra = await gatherReportExtra(resolve.label, specialty);
    return withAiNarrative(buildProposal(region, specialty, brand, input.monthlyBudget ?? 200, extra));
  });
}
