// GEO Studio 이식 골든 테스트 — 파이썬 원본과 수치 동등성 보장.
// 픽스처는 원본 geo_channel_planner(roi.py)/내장 round()를 목 모드로 실행해 생성.
import { describe, it, expect } from "vitest";
import { pyRound } from "./py-compat";
import { calculateRoi, compareScenarios, type RoiInput } from "./roi";

describe("pyRound — 파이썬 round() 파리티(banker's, IEEE 엣지 포함)", () => {
  it("ndigits=0", () => {
    expect(pyRound(0.5)).toBe(0);
    expect(pyRound(1.5)).toBe(2);
    expect(pyRound(2.5)).toBe(2);
    expect(pyRound(3.5)).toBe(4);
    expect(pyRound(-0.5)).toBe(0);
    expect(pyRound(-1.5)).toBe(-2);
  });
  it("ndigits=1", () => {
    expect(pyRound(2.45, 1)).toBe(2.5);
    expect(pyRound(2.55, 1)).toBe(2.5); // 2.55 double < 2.55 → 내림
    expect(pyRound(562.45, 1)).toBe(562.5);
    expect(pyRound(26.05, 1)).toBe(26.1); // 26.05 double > 26.05 → 올림 (x*10 방식은 26.0로 오답)
    expect(pyRound(0.05, 1)).toBe(0.1);
    expect(pyRound(0.15, 1)).toBe(0.1);
    expect(pyRound(0.25, 1)).toBe(0.2); // 정확히 .5 → 짝수
  });
  it("ndigits=2", () => {
    expect(pyRound(2.675, 2)).toBe(2.67);
    expect(pyRound(0.125, 2)).toBe(0.12);
    expect(pyRound(0.135, 2)).toBe(0.14);
    expect(pyRound(2.445, 2)).toBe(2.44);
  });
});

// ── ROI 골든 픽스처 (파이썬 calculate_roi 출력 그대로) ──
const ROI_GOLDEN: { input: RoiInput; output: { addedTraffic: number; conversions: number; revenue: number; investment: number; roiPct: number } }[] = [
  {
    input: { citationRateIncreasePp: 7, investment: 5_000_000, monthlySearchVolume: 100000, months: 3 },
    output: { addedTraffic: 6300.0, conversions: 126.0, revenue: 6_300_000, investment: 5_000_000, roiPct: 26.0 }
  },
  {
    input: { citationRateIncreasePp: 7, investment: 5_000_000 },
    output: { addedTraffic: 2100.0, conversions: 42.0, revenue: 2_100_000, investment: 5_000_000, roiPct: -58.0 }
  },
  {
    input: { citationRateIncreasePp: 12.5, investment: 3_000_000, ctr: 0.25, conversionRate: 0.03, orderValue: 80000, months: 6 },
    output: { addedTraffic: 18750.0, conversions: 562.5, revenue: 45_000_000, investment: 3_000_000, roiPct: 1400.0 }
  },
  {
    input: { citationRateIncreasePp: 0, investment: 1_000_000 },
    output: { addedTraffic: 0.0, conversions: 0.0, revenue: 0.0, investment: 1_000_000, roiPct: -100.0 }
  },
  {
    input: { citationRateIncreasePp: 5, investment: 0 },
    output: { addedTraffic: 1500.0, conversions: 30.0, revenue: 1_500_000, investment: 0, roiPct: 0.0 }
  }
];

describe("calculateRoi — 파이썬 골든 동등성", () => {
  for (const [i, c] of ROI_GOLDEN.entries()) {
    it(`case ${i}`, () => {
      const r = calculateRoi(c.input);
      expect(r.addedTraffic).toBe(c.output.addedTraffic);
      expect(r.conversions).toBe(c.output.conversions);
      expect(r.revenue).toBe(c.output.revenue);
      expect(r.investment).toBe(c.output.investment);
      expect(r.roiPct).toBe(c.output.roiPct);
    });
  }
});

describe("compareScenarios — ROI 내림차순 정렬 동등성", () => {
  it("3 시나리오", () => {
    const scen = [
      { name: "보수", citationRateIncreasePp: 5, investment: 3_000_000 },
      { name: "기본", citationRateIncreasePp: 7, investment: 5_000_000 },
      { name: "공격", citationRateIncreasePp: 12, investment: 8_000_000 }
    ];
    const golden = [
      { name: "보수", roiPct: -50.0, revenue: 1_500_000, conversions: 30.0 },
      { name: "공격", roiPct: -55.0, revenue: 3_600_000, conversions: 72.0 },
      { name: "기본", roiPct: -58.0, revenue: 2_100_000, conversions: 42.0 }
    ];
    expect(compareScenarios(scen)).toEqual(golden);
  });
});
