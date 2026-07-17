// GEO Studio · M5 채널 플래너 — ROI 계산기 (원본 geo_channel_planner/roi.py 이식).
//
// AI 인용율 증가 → 트래픽 → 전환 → 매출 기여 사슬을 수치화한다(기획안 3.3).
//   트래픽  = 인용율 증가분(%p) × 월 카테고리 검색량 × CTR
//   전환수  = 트래픽 × 전환율
//   매출    = 전환수 × 평균 주문 금액
//   ROI(%)  = (기여 매출 − 투자비) / 투자비 × 100
// GA4/CRM 실데이터가 있으면 인자로 주입, 없으면 기본 가정(defaults)으로 계산.
//
// 순수 로직 — 외부 의존 없음. 파이썬 `round`(banker's)를 pyRound로 재현해 동등성 보장.
import { pyRound } from "./py-compat";

/** ROI 계산 기본 가정(기획안 3.3). 원본 Settings 기본값과 동일. env로 조정 가능(비-시크릿). */
export type RoiDefaults = {
  ctr: number; // AI 인용→트래픽 CTR
  conversionRate: number; // 트래픽→전환율
  orderValue: number; // 평균 주문 금액(원)
  monthlySearchVolume: number; // 카테고리 월 검색량
};

export const ROI_DEFAULTS: RoiDefaults = {
  ctr: 0.3,
  conversionRate: 0.02,
  orderValue: 50000,
  monthlySearchVolume: 100000
};

/** GEO_ROI_* / GEO_MONTHLY_SEARCH env 반영(없으면 기본값). 모두 비-시크릿 튜닝값. */
export function roiDefaultsFromEnv(env: NodeJS.ProcessEnv = process.env): RoiDefaults {
  const num = (v: string | undefined, d: number) => {
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  return {
    ctr: num(env.GEO_ROI_CTR, ROI_DEFAULTS.ctr),
    conversionRate: num(env.GEO_ROI_CVR, ROI_DEFAULTS.conversionRate),
    orderValue: num(env.GEO_ROI_AOV, ROI_DEFAULTS.orderValue),
    monthlySearchVolume: num(env.GEO_MONTHLY_SEARCH, ROI_DEFAULTS.monthlySearchVolume)
  };
}

export type RoiInput = {
  citationRateIncreasePp: number; // 인용율 증가분(%p, 예: 18→25 이면 7)
  investment: number; // GEO 투자비(원)
  monthlySearchVolume?: number;
  ctr?: number;
  conversionRate?: number;
  orderValue?: number;
  months?: number;
};

export type RoiResult = {
  addedTraffic: number;
  conversions: number;
  revenue: number;
  investment: number;
  roiPct: number;
  detail: {
    citationRateIncreasePp: number;
    monthlySearchVolume: number;
    ctr: number;
    conversionRate: number;
    orderValue: number;
    months: number;
  };
};

/** GEO 기여 매출과 ROI를 계산한다. 원본 calculate_roi 동등. */
export function calculateRoi(input: RoiInput, defaults: RoiDefaults = ROI_DEFAULTS): RoiResult {
  const volume = input.monthlySearchVolume ?? defaults.monthlySearchVolume;
  const ctr = input.ctr ?? defaults.ctr;
  const cvr = input.conversionRate ?? defaults.conversionRate;
  const aov = input.orderValue ?? defaults.orderValue;
  const months = input.months ?? 1;

  const inc = Math.max(0, input.citationRateIncreasePp) / 100;
  const monthlyTraffic = inc * volume * ctr;
  const traffic = monthlyTraffic * months;
  const conversions = traffic * cvr;
  const revenue = conversions * aov;
  const roi = input.investment > 0 ? pyRound(((revenue - input.investment) / input.investment) * 100, 1) : 0.0;

  return {
    addedTraffic: pyRound(traffic, 1),
    conversions: pyRound(conversions, 1),
    revenue: pyRound(revenue, 0),
    investment: input.investment,
    roiPct: roi,
    detail: {
      citationRateIncreasePp: input.citationRateIncreasePp,
      monthlySearchVolume: volume,
      ctr,
      conversionRate: cvr,
      orderValue: aov,
      months
    }
  };
}

export type ScenarioInput = RoiInput & { name?: string };
export type ScenarioResult = { name: string; roiPct: number; revenue: number; conversions: number };

/** 여러 시나리오 ROI 비교(ROI 내림차순, 동점은 원래 순서 유지 — 원본 stable sort 동등). */
export function compareScenarios(scenarios: ScenarioInput[], defaults: RoiDefaults = ROI_DEFAULTS): ScenarioResult[] {
  const out = scenarios.map((sc) => {
    const { name, ...params } = sc;
    const res = calculateRoi(params, defaults);
    return { name: name ?? "", roiPct: res.roiPct, revenue: res.revenue, conversions: res.conversions };
  });
  // Array.prototype.sort는 안정 정렬 → 동점 시 원래 순서 유지(파이썬 sorted reverse=True와 동일).
  return out.sort((a, b) => b.roiPct - a.roiPct);
}
