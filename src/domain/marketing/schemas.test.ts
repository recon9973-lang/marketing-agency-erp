// src/domain/marketing/schemas.test.ts
import { describe, it, expect } from "vitest";
import { canTransition, canPublish } from "./schemas";

describe("VME 파이프라인 상태머신", () => {
  it("허용된 스테이지 전이만 통과한다", () => {
    expect(canTransition("RESEARCH", "DRAFTING")).toBe(true);
    expect(canTransition("DRAFTING", "COMPLIANCE_REVIEW")).toBe(true);
    expect(canTransition("COMPLIANCE_REVIEW", "READY")).toBe(true);
    expect(canTransition("COMPLIANCE_REVIEW", "DRAFTING")).toBe(true); // 반려
    // 잘못된 순서 차단
    expect(canTransition("DRAFTING", "PUBLISHED")).toBe(false);
    expect(canTransition("RESEARCH", "PUBLISHED")).toBe(false);
    expect(canTransition("PUBLISHED", "DRAFTING")).toBe(false); // 종료 상태
  });

  it("컴플라이언스 게이트: BLOCK/PENDING이면 발행 불가", () => {
    expect(canPublish("READY", "PASS")).toBe(true);
    expect(canPublish("SCHEDULED", "WARN")).toBe(true);
    expect(canPublish("READY", "BLOCK")).toBe(false); // 의료광고법 차단
    expect(canPublish("READY", "PENDING")).toBe(false); // 미검수
    expect(canPublish("DRAFTING", "PASS")).toBe(false); // 스테이지 미달
  });
});
