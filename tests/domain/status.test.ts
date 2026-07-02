import { describe, expect, it } from "vitest";
import {
  BillingStatus,
  ExpenseReviewStatus,
  LeaveStatus,
  ReportStatus,
  WorkStatus
} from "@/domain/types";
import {
  billingStatusDisplay,
  billingStatusTones,
  expenseReviewStatusDisplay,
  leaveStatusDisplay,
  reportStatusDisplay,
  reportStatusTones,
  workStatusDisplay,
  workStatusTones
} from "@/domain/status";

describe("status display mapping", () => {
  it("maps work statuses to label and tone", () => {
    expect(workStatusDisplay(WorkStatus.COMPLETED)).toEqual({ label: "완료", tone: "success" });
    expect(workStatusDisplay(WorkStatus.BLOCKED).tone).toBe("danger");
  });

  it("maps billing statuses to tones", () => {
    expect(billingStatusDisplay(BillingStatus.PAID).tone).toBe("success");
    expect(billingStatusDisplay(BillingStatus.OVERDUE).tone).toBe("danger");
  });

  it("maps leave, expense and report statuses", () => {
    expect(leaveStatusDisplay(LeaveStatus.APPROVED).tone).toBe("success");
    expect(expenseReviewStatusDisplay(ExpenseReviewStatus.NEEDS_FOLLOW_UP).tone).toBe("danger");
    expect(reportStatusDisplay(ReportStatus.DELIVERED)).toEqual({ label: "전달완료", tone: "info" });
  });

  it("defines a tone for every enum value", () => {
    for (const status of Object.values(WorkStatus)) {
      expect(workStatusTones[status]).toBeDefined();
    }
    for (const status of Object.values(BillingStatus)) {
      expect(billingStatusTones[status]).toBeDefined();
    }
    for (const status of Object.values(ReportStatus)) {
      expect(reportStatusTones[status]).toBeDefined();
    }
  });
});
