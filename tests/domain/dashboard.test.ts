import { describe, expect, it } from "vitest";
import { summarizeDashboard } from "@/domain/dashboard";
import { BillingStatus, WorkStatus } from "@/domain/types";

describe("dashboard aggregation", () => {
  it("counts overdue billing and delayed work", () => {
    const summary = summarizeDashboard({
      workItems: [
        { status: WorkStatus.IN_PROGRESS, dueDate: "2026-06-20" },
        { status: WorkStatus.COMPLETED, dueDate: "2026-06-20" }
      ],
      billings: [
        { status: BillingStatus.OVERDUE, issuedAmount: 1000000, paidAmount: 0 },
        { status: BillingStatus.PAID, issuedAmount: 500000, paidAmount: 500000 }
      ],
      expenses: [{ amount: 300000 }],
      leaveRequests: [{ status: "REQUESTED" }]
    });

    expect(summary.delayedWorkCount).toBe(1);
    expect(summary.unpaidAmount).toBe(1000000);
    expect(summary.expenseTotal).toBe(300000);
    expect(summary.pendingLeaveCount).toBe(1);
  });
});
