// src/server/compliance/medical-law.test.ts
import { describe, it, expect } from "vitest";
import { checkMedicalLaw, checkGuaranteeClaims, NON_GUARANTEE_DISCLAIMER } from "./medical-law";

describe("성과 보장성 문구 검사 (기획서 §9 성과표현)", () => {
  it("상위노출·순위 보장 문구를 감지한다", () => {
    const r = checkGuaranteeClaims("네이버 상위노출 보장! 1페이지 보장해 드립니다.");
    expect(r.highCount).toBeGreaterThanOrEqual(2);
    expect(r.flags.some((f) => f.type === "rank_guarantee")).toBe(true);
  });

  it("AI 노출·성과 보장 문구를 감지한다", () => {
    const r = checkGuaranteeClaims("AI 답변 노출 보장, 문의 증가 보장까지 책임집니다.");
    expect(r.flags.some((f) => f.type === "ai_guarantee")).toBe(true);
    expect(r.flags.some((f) => f.type === "outcome_guarantee")).toBe(true);
  });

  it("정상 문구는 통과한다", () => {
    const r = checkGuaranteeClaims("검색 노출 개선을 위한 SEO 진단과 콘텐츠 운영을 제공합니다.");
    expect(r.flags).toHaveLength(0);
  });

  it("의료법 검사(checkMedicalLaw)와 분리되어 서로 오염되지 않는다", () => {
    const text = "상위노출 보장";
    const claims = checkGuaranteeClaims(text);
    // "상위노출 보장"이 상위/일반 패턴에 이중 집계되지 않아야 한다
    expect(claims.flags.filter((f) => f.type === "rank_guarantee")).toHaveLength(1);
    // 의료법 사전에는 보장성 마케팅 문구 규칙이 없어야 함(기존 검수 결과 보호)
    expect(checkMedicalLaw(text).flags.every((f) => f.type !== "rank_guarantee")).toBe(true);
  });

  it("미보장 고지문이 정의되어 있다", () => {
    expect(NON_GUARANTEE_DISCLAIMER).toContain("보장하지 않습니다");
  });
});

describe("의료법 위험표현 검사 (기존 동작 회귀)", () => {
  it("최상급·완치 표현을 high로 감지한다", () => {
    const r = checkMedicalLaw("최고의 의료진이 완치를 약속합니다");
    expect(r.highCount).toBeGreaterThanOrEqual(2);
  });

  it("치료 전후 비교 사진·비포애프터·before/after를 후기성(치료효과 오인)으로 감지한다", () => {
    for (const text of ["시술 전후 사진 보기", "치료 전후 비교", "비포애프터 확인", "before/after 결과"]) {
      const r = checkMedicalLaw(text);
      expect(r.flags.some((f) => f.type === "testimonial")).toBe(true);
    }
  });

  it("정상적인 '수술 전후 주의사항' 안내 문구는 오탐하지 않는다", () => {
    const r = checkMedicalLaw("수술 전후 주의사항을 안내드립니다");
    expect(r.flags.some((f) => f.type === "testimonial")).toBe(false);
  });
});
