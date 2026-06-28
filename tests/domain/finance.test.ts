import { describe, expect, it } from "vitest";
import { getBillingStatus, summarizeFinance } from "@/domain/finance";
import { BillingStatus, ExpenseReviewStatus } from "@/domain/types";

describe("finance rules", () => {
  it("detects partially paid bills", () => {
    expect(getBillingStatus({ issuedAmount: 1000000, paidAmount: 300000, dueDate: "2026-06-30" }, "2026-06-28")).toBe(BillingStatus.PARTIALLY_PAID);
  });

  it("summarizes unpaid billing and reviewed expenses", () => {
    const summary = summarizeFinance({
      billings: [{ issuedAmount: 1000000, paidAmount: 300000 }],
      expenses: [{ amount: 120000, reviewStatus: ExpenseReviewStatus.REVIEWED }]
    });
    expect(summary.unpaidAmount).toBe(700000);
    expect(summary.reviewedExpenseAmount).toBe(120000);
  });
});
