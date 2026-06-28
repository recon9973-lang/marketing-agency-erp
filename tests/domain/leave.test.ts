import { describe, expect, it } from "vitest";
import { calculateRemainingLeave, transitionLeave } from "@/domain/leave";
import { LeaveStatus } from "@/domain/types";

describe("leave rules", () => {
  it("subtracts approved leave from allowance", () => {
    expect(calculateRemainingLeave(15, [{ days: 2, status: LeaveStatus.APPROVED }])).toBe(13);
  });

  it("allows requested leave to be approved", () => {
    expect(transitionLeave(LeaveStatus.REQUESTED, "approve")).toBe(LeaveStatus.APPROVED);
  });
});
