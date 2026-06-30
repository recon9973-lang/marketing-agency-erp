import { z } from "zod";
import { BillingStatus, ExpenseReviewStatus, PaymentMethod } from "@/domain/types";
import { amountSchema, enumSchema, isoDateSchema, optionalString, requiredString } from "@/domain/validation";

export type BillingStatusInput = {
  issuedAmount: number;
  paidAmount: number;
  dueDate?: Date | string | null;
};

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalIsoDate = z.preprocess(emptyToUndefined, isoDateSchema.optional());

function positiveAmount(label: string) {
  return z.coerce
    .number({ invalid_type_error: `${label}은(는) 숫자여야 합니다.` })
    .int(`${label}은(는) 원 단위 정수여야 합니다.`)
    .positive(`${label}은(는) 0보다 커야 합니다.`);
}

/** 거래처 청구(BillingRecord) 입력 검증 (V2 §5). */
export const billingFormSchema = z.object({
  clientId: requiredString("거래처", 60),
  billingMonth: isoDateSchema,
  contractAmount: amountSchema("계약금액"),
  issuedAmount: amountSchema("청구금액"),
  dueDate: optionalIsoDate,
  invoiceNumber: optionalString(60)
});

export type BillingFormInput = z.infer<typeof billingFormSchema>;

/** 입금(PaymentRecord) 기록 입력 검증 (V2 §5). */
export const paymentFormSchema = z.object({
  billingRecordId: requiredString("청구", 60),
  amount: positiveAmount("입금액"),
  method: enumSchema(PaymentMethod, "결제수단"),
  receivedAt: isoDateSchema,
  transactionId: optionalString(100)
});

export type PaymentFormInput = z.infer<typeof paymentFormSchema>;

/** 회사 지출(ExpenseRecord) 입력 검증 (V2 §5). */
export const expenseFormSchema = z.object({
  clientId: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(60).optional()),
  category: requiredString("지출 분류", 100),
  vendor: optionalString(100),
  amount: positiveAmount("금액"),
  taxAmount: z.preprocess(emptyToUndefined, amountSchema("부가세").optional()),
  paymentMethod: enumSchema(PaymentMethod, "결제수단"),
  memo: optionalString(500),
  paidAt: optionalIsoDate
});

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;

/** 지출 검토 결과 입력 검증 (V2 §5). UNREVIEWED는 검토 결과로 설정할 수 없다. */
export const expenseReviewSchema = z.object({
  id: requiredString("지출", 60),
  reviewStatus: z.enum([
    ExpenseReviewStatus.REVIEWED,
    ExpenseReviewStatus.EXCLUDED,
    ExpenseReviewStatus.NEEDS_FOLLOW_UP
  ]),
  excludedReason: optionalString(500)
});

export type ExpenseReviewInput = z.infer<typeof expenseReviewSchema>;

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
