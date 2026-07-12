// src/domain/sales/lead-stages.test.ts
import { describe, it, expect } from "vitest";
import { canTransitionLead, computeAuditScore, isLeadStatus, ACTIVE_LEAD_STAGES } from "./lead-stages";

describe("리드 파이프라인 상태머신 (기획서 §12)", () => {
  it("정방향 전이를 허용한다", () => {
    expect(canTransitionLead("NEW", "CONTACTING")).toBe(true);
    expect(canTransitionLead("CONTACTING", "AUDIT")).toBe(true);
    expect(canTransitionLead("AUDIT", "MEETING")).toBe(true);
    expect(canTransitionLead("MEETING", "PROPOSAL")).toBe(true);
    expect(canTransitionLead("PROPOSAL", "WON")).toBe(true);
  });

  it("진단 생략(CONTACTING→PROPOSAL)과 오입력 정정용 1단계 후진을 허용한다", () => {
    expect(canTransitionLead("CONTACTING", "PROPOSAL")).toBe(true);
    expect(canTransitionLead("AUDIT", "CONTACTING")).toBe(true);
    expect(canTransitionLead("PROPOSAL", "MEETING")).toBe(true);
  });

  it("WON은 터미널, LOST→RECONTACT→CONTACTING 복귀를 허용한다", () => {
    expect(canTransitionLead("WON", "CONTACTING")).toBe(false);
    expect(canTransitionLead("WON", "LOST")).toBe(false);
    expect(canTransitionLead("LOST", "RECONTACT")).toBe(true);
    expect(canTransitionLead("RECONTACT", "CONTACTING")).toBe(true);
  });

  it("2단계 이상 점프를 차단한다", () => {
    expect(canTransitionLead("NEW", "PROPOSAL")).toBe(false);
    expect(canTransitionLead("NEW", "WON")).toBe(false);
    expect(canTransitionLead("CONTACTING", "WON")).toBe(false);
  });

  it("보드 활성 단계는 종결/재접촉을 제외한 5단계", () => {
    expect(ACTIVE_LEAD_STAGES).toHaveLength(5);
    expect(ACTIVE_LEAD_STAGES).not.toContain("WON");
    expect(ACTIVE_LEAD_STAGES).not.toContain("LOST");
    expect(ACTIVE_LEAD_STAGES).not.toContain("RECONTACT");
  });

  it("isLeadStatus는 유효 상태만 통과시킨다", () => {
    expect(isLeadStatus("AUDIT")).toBe(true);
    expect(isLeadStatus("INVALID")).toBe(false);
  });
});

describe("무료진단 점수 (§11 초기진단 8항목)", () => {
  it("통과 비율로 100점 만점 점수를 계산한다", () => {
    expect(computeAuditScore({})).toBe(0);
    expect(computeAuditScore({ indexing: true, meta: true, sitemap: true, robots: true })).toBe(50);
    expect(
      computeAuditScore({
        indexing: true,
        meta: true,
        sitemap: true,
        robots: true,
        mobile: true,
        structure: true,
        cta: true,
        profile: true
      })
    ).toBe(100);
  });

  it("false/누락 항목은 미통과로 집계한다", () => {
    expect(computeAuditScore({ indexing: true, meta: false })).toBe(13); // 1/8
  });
});
