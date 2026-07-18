// GEO Studio · 통합 파이프라인 — 배선 불변식 테스트.
// 목 RNG는 파이썬과 무관(dev 전용)이라 수치 골든 대신, 단계 간 데이터가 올바르게
// 연결되는지(각 단계 산출물 → CurrentState → M5)를 검증한다.
import { describe, it, expect } from "vitest";
import { runPipeline } from "./pipeline";

describe("GEO Studio 파이프라인 배선", () => {
  const r = runPipeline({
    brand: "베놈한의원",
    category: "강남 한의원",
    keywords: ["강남 한의원", "다이어트 한약"],
    competitors: ["서울메디컬"],
    budget: 5_000_000
  });

  it("5단계 산출물이 모두 존재", () => {
    expect(r.stages.m1).toBeTruthy();
    expect(r.stages.m2).toBeTruthy();
    expect(r.stages.m3).toBeTruthy();
    expect(r.stages.m4).toBeTruthy();
    expect(r.stages.m5).toBeTruthy();
  });

  it("M1 인용율이 CurrentState로 흐른다", () => {
    expect(r.currentState.citationRate).toBe(r.stages.m1.citationRate);
    expect(r.stages.m1.totalQueries).toBe(2 * 3 * 4); // 키워드2 × 3변형 × 4 AI
  });

  it("M2 커버리지 = (총 CEP − 화이트스페이스)/총 CEP, CurrentState와 일치", () => {
    const { totalCeps, coveredCeps, whitespaceCount, cepCoverage } = r.stages.m2;
    expect(coveredCeps).toBe(totalCeps - whitespaceCount);
    expect(r.currentState.cepCoverage).toBe(cepCoverage);
    expect(r.currentState.totalCeps).toBe(totalCeps);
    expect(r.currentState.coveredCeps).toBe(coveredCeps);
  });

  it("M3 GEO 게이트(70점) 판정이 점수와 일관", () => {
    expect(r.stages.m3.passed).toBe(r.stages.m3.geoScore >= 70);
    expect(r.stages.m3.briefMd.length).toBeGreaterThan(0);
  });

  it("M4 TA 점수가 CurrentState로 흐르고 등급이 점수와 일관", () => {
    expect(r.currentState.taScore).toBe(r.stages.m4.taScore);
    const s = r.stages.m4.taScore;
    const expected = s >= 80 ? "A" : s >= 60 ? "B" : s >= 40 ? "C" : "D";
    expect(r.stages.m4.taGrade).toBe(expected);
  });

  it("M5 캠페인이 목표·예산을 반영해 태스크/ROI를 산출", () => {
    const m5 = r.stages.m5 as { task_count: number; estimated_roi_pct: number; goal: { target: number } };
    expect(m5.task_count).toBeGreaterThan(0);
    expect(typeof m5.estimated_roi_pct).toBe("number");
    expect(r.goal.budget).toBe(5_000_000);
  });
});
