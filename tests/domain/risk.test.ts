import { describe, expect, it } from "vitest";
import {
  RISK_STATUSES,
  canTransitionRisk,
  isOpenRisk,
  isRiskStatus,
  severityScore,
  riskStatusLabels,
} from "@/domain/sales/risk";

describe("리스크 상태 전이·점수(§12)", () => {
  it("정상 전진 및 반려/재발 전이", () => {
    expect(canTransitionRisk("DETECTED", "CONFIRMED")).toBe(true);
    expect(canTransitionRisk("REVIEW", "FIXING")).toBe(true); // 재검수 실패 반려
    expect(canTransitionRisk("RESOLVED", "DETECTED")).toBe(true); // 재발
    expect(canTransitionRisk("FIXING", "RESOLVED")).toBe(false); // 재검수 없이 해소 불가
    expect(canTransitionRisk("ARCHIVED", "DETECTED")).toBe(false); // 터미널
  });

  it("미해소 상태 판별(완료 게이트)", () => {
    for (const s of ["DETECTED", "CONFIRMED", "FIXING", "REVIEW"]) expect(isOpenRisk(s)).toBe(true);
    for (const s of ["RESOLVED", "ARCHIVED"]) expect(isOpenRisk(s)).toBe(false);
  });

  it("심각도 점수", () => {
    expect(severityScore("high")).toBe(3);
    expect(severityScore("medium")).toBe(2);
    expect(severityScore("low")).toBe(1);
  });

  it("라벨·가드", () => {
    for (const s of RISK_STATUSES) expect(riskStatusLabels[s]).toBeTruthy();
    expect(isRiskStatus("REVIEW")).toBe(true);
    expect(isRiskStatus("X")).toBe(false);
  });
});
