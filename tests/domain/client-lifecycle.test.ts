import { describe, expect, it } from "vitest";
import {
  CLIENT_LIFECYCLE_STATUSES,
  canTransitionClientLifecycle,
  isClientLifecycleStatus,
  clientLifecycleLabels,
} from "@/domain/sales/client-lifecycle";

describe("거래처 생명주기 전이 규칙(§12)", () => {
  it("정상 전진 전이를 허용한다", () => {
    expect(canTransitionClientLifecycle("ONBOARDING", "DIAGNOSING")).toBe(true);
    expect(canTransitionClientLifecycle("BUILDING", "OPERATING")).toBe(true);
    expect(canTransitionClientLifecycle("OPERATING", "RENEWAL_PENDING")).toBe(true);
    expect(canTransitionClientLifecycle("RENEWAL_PENDING", "OPERATING")).toBe(true); // 재계약 성공
    expect(canTransitionClientLifecycle("ENDED", "OPERATING")).toBe(true); // 재개
  });

  it("2단계 점프·역주행은 막는다", () => {
    expect(canTransitionClientLifecycle("ONBOARDING", "OPERATING")).toBe(false);
    expect(canTransitionClientLifecycle("OPERATING", "ONBOARDING")).toBe(false);
    expect(canTransitionClientLifecycle("ENDED", "BUILDING")).toBe(false);
  });

  it("모든 상태에 라벨이 있다", () => {
    for (const s of CLIENT_LIFECYCLE_STATUSES) expect(clientLifecycleLabels[s]).toBeTruthy();
  });

  it("상태 판별 가드가 동작한다", () => {
    expect(isClientLifecycleStatus("OPERATING")).toBe(true);
    expect(isClientLifecycleStatus("NOPE")).toBe(false);
    expect(isClientLifecycleStatus(null)).toBe(false);
  });
});
