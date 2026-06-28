import { describe, expect, it } from "vitest";
import { summarizeDashboard } from "@/domain/dashboard";
import { BillingStatus, LeaveStatus, WorkCategory, WorkStatus } from "@/domain/types";

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
      leaveRequests: [{ status: LeaveStatus.REQUESTED }],
      today: "2026-06-28"
    });

    expect(summary.delayedWorkCount).toBe(1);
    expect(summary.unpaidAmount).toBe(1000000);
    expect(summary.expenseTotal).toBe(300000);
    expect(summary.pendingLeaveCount).toBe(1);
  });

  it("uses enum values and exact decimal cents for report and money counts", () => {
    const summary = summarizeDashboard({
      workItems: [{ status: WorkStatus.NOT_STARTED, dueDate: "2026-06-28", category: WorkCategory.MONTHLY_REPORT }],
      billings: [{ status: BillingStatus.PARTIALLY_PAID, issuedAmount: "0.30", paidAmount: "0.10" }],
      expenses: [{ amount: "0.10" }, { amount: "0.20" }],
      leaveRequests: [{ status: LeaveStatus.APPROVED }],
      today: "2026-06-28"
    });

    expect(summary.reportTaskCount).toBe(1);
    expect(summary.unpaidAmount).toBe(0.2);
    expect(summary.expenseTotal).toBe(0.3);
  });

  it("classifies Date values by the configured business timezone", () => {
    const summary = summarizeDashboard({
      workItems: [
        { status: WorkStatus.IN_PROGRESS, dueDate: new Date("2026-06-27T15:30:00.000Z") },
        { status: WorkStatus.IN_PROGRESS, dueDate: new Date("2026-06-27T14:30:00.000Z") }
      ],
      billings: [],
      expenses: [],
      leaveRequests: [],
      today: "2026-06-28",
      timeZone: "Asia/Seoul"
    });

    expect(summary.todayWorkCount).toBe(1);
    expect(summary.delayedWorkCount).toBe(1);
  });
});
