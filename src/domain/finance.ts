import { BillingStatus, ExpenseReviewStatus, PaymentMethod } from "@/domain/types";

export type BillingStatusInput = {
  issuedAmount: number;
  paidAmount: number;
  dueDate?: Date | string | null;
};

export type FinanceSummaryInput = {
  billings: Array<{
    issuedAmount: number;
    paidAmount: number;
  }>;
  expenses: Array<{
    amount: number;
    reviewStatus: ExpenseReviewStatus;
  }>;
};

export const billingStatusLabels: Record<BillingStatus, string> = {
  [BillingStatus.DRAFT]: "작성중",
  [BillingStatus.ISSUED]: "청구",
  [BillingStatus.UNPAID]: "미입금",
  [BillingStatus.PARTIALLY_PAID]: "부분입금",
  [BillingStatus.PAID]: "입금완료",
  [BillingStatus.OVERDUE]: "연체",
  [BillingStatus.CANCELED]: "취소"
};

export const expenseReviewStatusLabels: Record<ExpenseReviewStatus, string> = {
  [ExpenseReviewStatus.UNREVIEWED]: "미검토",
  [ExpenseReviewStatus.REVIEWED]: "검토완료",
  [ExpenseReviewStatus.EXCLUDED]: "제외",
  [ExpenseReviewStatus.NEEDS_FOLLOW_UP]: "확인필요"
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.BANK_TRANSFER]: "계좌이체",
  [PaymentMethod.CARD]: "카드",
  [PaymentMethod.CASH]: "현금",
  [PaymentMethod.VIRTUAL_ACCOUNT]: "가상계좌",
  [PaymentMethod.OTHER]: "기타"
};

function dateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export function getBillingStatus(billing: BillingStatusInput, today: Date | string) {
  if (billing.paidAmount >= billing.issuedAmount) {
    return BillingStatus.PAID;
  }

  if (billing.paidAmount > 0) {
    return BillingStatus.PARTIALLY_PAID;
  }

  if (billing.dueDate && dateOnly(billing.dueDate) < dateOnly(today)) {
    return BillingStatus.OVERDUE;
  }

  return BillingStatus.UNPAID;
}

export function summarizeFinance(input: FinanceSummaryInput) {
  return {
    unpaidAmount: input.billings.reduce((sum, billing) => sum + Math.max(billing.issuedAmount - billing.paidAmount, 0), 0),
    reviewedExpenseAmount: input.expenses.reduce(
      (sum, expense) => (expense.reviewStatus === ExpenseReviewStatus.REVIEWED ? sum + expense.amount : sum),
      0
    )
  };
}
