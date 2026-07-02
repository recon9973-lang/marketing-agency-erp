import { describe, expect, it } from "vitest";
import { leaveRequestFormSchema } from "@/domain/leave";
import { LeaveType } from "@/domain/types";

const validBase = {
  type: LeaveType.ANNUAL,
  startDate: "2026-07-01",
  endDate: "2026-07-03",
  daysRequested: "3"
};

describe("leaveRequestFormSchema", () => {
  it("parses a valid request and coerces days", () => {
    const parsed = leaveRequestFormSchema.parse(validBase);
    expect(parsed.daysRequested).toBe(3);
    expect(parsed.type).toBe(LeaveType.ANNUAL);
  });

  it("accepts half-day requests", () => {
    const parsed = leaveRequestFormSchema.parse({ ...validBase, type: LeaveType.HALF_DAY_AM, daysRequested: "0.5" });
    expect(parsed.daysRequested).toBe(0.5);
  });

  it("rejects non-positive days", () => {
    expect(leaveRequestFormSchema.safeParse({ ...validBase, daysRequested: "0" }).success).toBe(false);
    expect(leaveRequestFormSchema.safeParse({ ...validBase, daysRequested: "-1" }).success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const invalid = leaveRequestFormSchema.safeParse({ ...validBase, startDate: "2026-07-05", endDate: "2026-07-01" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.path).toEqual(["endDate"]);
    }
  });

  it("rejects an invalid leave type", () => {
    expect(leaveRequestFormSchema.safeParse({ ...validBase, type: "NOPE" }).success).toBe(false);
  });
});
