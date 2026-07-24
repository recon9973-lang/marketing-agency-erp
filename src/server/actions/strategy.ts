"use server";

/**
 * 마케팅 전략 트랙 — 병원_검색여정·퍼널 기획서 계열.
 * 상권분석(트랙1)을 **입력 근거로 소비**해 수주 진단·진입 대응방향 + 키워드 실측을 낸다.
 * ※ 상권분석과 별개 트랙. 상권 화면(/market)에는 전략 내용을 넣지 않는다.
 */
import { runAction, type ActionResult } from "@/server/action-result";
import { requireUser } from "@/server/actions/_helpers";
import {
  getLocationInsight,
  getOpenings,
  nationalHospitalsPerTenThousand,
  getRegionIncome,
  getRegionAccess,
  getDemandBySpecialty
} from "@/server/data/region-insight";
import { buildScorecard } from "@/server/market/scorecard";
import { buildAcquisitionReview, consultingReviewMarkdown, type ConsultingReview } from "@/server/market/consulting-review";
import { scanKeywords, type KeywordScan } from "@/server/market/keyword-scan";

export type MarketingStrategy = {
  regionLabel: string;
  specialty: string | null;
  resolved: boolean; // 상권 키 해결(상권 근거 확보) 여부
  acquisition: { review: ConsultingReview; markdown: string } | null; // 수주 진단·대응 방향
  keywords: KeywordScan; // 키워드 실측(검색량·경쟁·포화도)
};

/** 병원+지역+진료과 → 마케팅 전략(수주 진단 + 키워드 실측). 상권분석 데이터를 근거로 소비. */
export async function analyzeMarketingStrategy(input: {
  brand?: string | null;
  region: string;
  specialty?: string | null;
}): Promise<ActionResult<MarketingStrategy>> {
  return runAction(async (): Promise<MarketingStrategy> => {
    await requireUser();
    const specialty = input.specialty?.trim() || null;
    const { resolve, population, hospitals } = getLocationInsight((input.region ?? "").trim());
    const label = resolve.key ? resolve.label : (input.region ?? "").trim();
    const nationalPer = nationalHospitalsPerTenThousand();
    const key = resolve.key;

    const scorecard = key ? buildScorecard({ population, hospitals, openings: getOpenings(key), nationalPer }) : null;
    const openings = key ? getOpenings(key) : null;
    const income = key ? getRegionIncome(key.split("|")[0]) : null;
    const access = key ? getRegionAccess(key) : null;
    const demand = specialty ? getDemandBySpecialty(specialty) : [];

    let acquisition: MarketingStrategy["acquisition"] = null;
    if (key) {
      const review = buildAcquisitionReview({
        hospitalName: input.brand?.trim() || "(신규 병원)",
        region: label,
        specialty,
        populationTotal: population?.total ?? null,
        femaleRatio: population?.femaleRatio ?? null,
        populationDelta: population?.delta ?? null,
        perTenThousand: hospitals?.perTenThousand ?? null,
        nationalPer,
        openingsY1: openings?.y1 ?? null,
        scoreGrade: scorecard?.grade ?? null,
        scoreOverall: scorecard?.overall ?? null,
        incomeIndex: income?.index ?? null,
        accessLevel: access?.level ?? null,
        accessLabel: access?.label ?? null,
        demandRows: demand.length
      });
      const markdown = consultingReviewMarkdown(review, {
        region: label,
        departments: specialty ? [specialty] : [],
        date: new Date().toISOString().slice(0, 10),
        title: "신규 수주 진단"
      });
      acquisition = { review, markdown };
    }

    const keywords = await scanKeywords(label, specialty);
    return { regionLabel: label, specialty, resolved: Boolean(key), acquisition, keywords };
  });
}
