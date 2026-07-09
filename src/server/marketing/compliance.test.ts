// src/server/marketing/compliance.test.ts
import { describe, it, expect } from "vitest";
import { reviewMedicalCompliance } from "./compliance";

describe("의료광고법 컴플라이언스 검수", () => {
  it("치료효과 보장·단정은 BLOCK", () => {
    expect(reviewMedicalCompliance("이 시술은 100% 완치되고 부작용 없습니다.").verdict).toBe("BLOCK");
    expect(reviewMedicalCompliance("반드시 낫습니다.").verdict).toBe("BLOCK");
  });

  it("근거 없는 최상급·유일성은 BLOCK", () => {
    expect(reviewMedicalCompliance("국내 1위, 유일한 최고의 병원입니다.").verdict).toBe("BLOCK");
  });

  it("환자 유인(할인 이벤트)은 WARN", () => {
    const r = reviewMedicalCompliance("지금 할인 이벤트 진행 중, 개인차가 있으며 상담이 필요합니다.");
    expect(r.verdict).toBe("WARN");
    expect(r.findings.some((f) => f.rule === "환자 유인")).toBe(true);
  });

  it("효과를 언급했으나 부작용·주의가 없으면 WARN", () => {
    expect(reviewMedicalCompliance("이 치료는 통증 개선에 효과가 있습니다.").verdict).toBe("WARN");
  });

  it("효과+부작용·주의·상담을 함께 안전하게 서술하면 PASS", () => {
    const safe =
      "통증 개선 효과가 있을 수 있으나 개인에 따라 다를 수 있으며, 부작용과 주의사항은 의료진 상담이 필요합니다.";
    expect(reviewMedicalCompliance(safe).verdict).toBe("PASS");
  });
});
