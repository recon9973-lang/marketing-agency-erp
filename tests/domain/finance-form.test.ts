import { describe, expect, it } from "vitest";
import {
  billingFormSchema,
  expenseFormSchema,
  expenseReviewSchema,
  paymentFormSchema
} from "@/domain/finance";
import { ExpenseReviewStatus, PaymentMethod } from "@/domain/types";

describe("billingFormSchema", () => {
  const valid = { clientId: "c1", billingMonth: "2026-06-01", contractAmount: "1000000", issuedAmount: "1000000" };

  it("parses a valid billing and coerces amounts", () => {
    const parsed = billingFormSchema.parse(valid);
    expect(parsed.contractAmount).toBe(1000000);
    expect(parsed.issuedAmount).toBe(1000000);
    expect(parsed.dueDate).toBeUndefined();
  });

  it("requires client and amounts", () => {
    expect(billingFormSchema.safeParse({ ...valid, clientId: "" }).success).toBe(false);
    expect(billingFormSchema.safeParse({ ...valid, issuedAmount: "-1" }).success).toBe(false);
  });
});

describe("paymentFormSchema", () => {
  const valid = { billingRecordId: "b1", amount: "500000", method: PaymentMethod.BANK_TRANSFER, receivedAt: "2026-06-15" };

  it("parses a valid payment", () => {
    expect(paymentFormSchema.parse(valid).amount).toBe(500000);
  });

  it("requires a positive amount and valid method", () => {
    expect(paymentFormSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...valid, method: "NOPE" }).success).toBe(false);
  });
});

describe("expenseFormSchema", () => {
  const valid = { category: "광고비", amount: "30000", paymentMethod: PaymentMethod.CARD };

  it("parses a valid expense and normalizes optional client", () => {
    const parsed = expenseFormSchema.parse({ ...valid, clientId: "" });
    expect(parsed.amount).toBe(30000);
    expect(parsed.clientId).toBeUndefined();
  });

  it("requires category and positive amount", () => {
    expect(expenseFormSchema.safeParse({ ...valid, category: "" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
  });
});

describe("expenseReviewSchema", () => {
  it("accepts terminal review statuses", () => {
    expect(expenseReviewSchema.parse({ id: "e1", reviewStatus: ExpenseReviewStatus.REVIEWED }).reviewStatus).toBe(
      ExpenseReviewStatus.REVIEWED
    );
  });

  it("rejects UNREVIEWED as a review outcome", () => {
    expect(expenseReviewSchema.safeParse({ id: "e1", reviewStatus: ExpenseReviewStatus.UNREVIEWED }).success).toBe(false);
  });
});
