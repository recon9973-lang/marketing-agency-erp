import type { Prisma } from "@prisma/client";
import { summarizeFinance } from "@/domain/finance";
import { BillingStatus, ConnectionStatus, ExpenseReviewStatus, FinancialAccountType, PaymentMethod, PaymentProvider, Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

type AdminScope = {
  clientId: string | null;
  marketerId: string | null;
  allClients: boolean;
  allMarketers: boolean;
};

export type BillingListItem = {
  id: string;
  clientName: string;
  billingMonth: Date;
  issuedAmount: number;
  paidAmount: number;
  status: BillingStatus;
  dueDate: Date | null;
  invoiceNumber: string | null;
};

export type ExpenseListItem = {
  id: string;
  vendor: string | null;
  category: string;
  clientName: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  reviewStatus: ExpenseReviewStatus;
  paidAt: Date | null;
  accountLabel: string | null;
};

export type FinancialAccountListItem = {
  id: string;
  type: FinancialAccountType;
  displayName: string;
  institutionName: string | null;
  accountLast4: string | null;
  cardLast4: string | null;
  connectionStatus: ConnectionStatus;
};

export type FinanceOverview = {
  billings: BillingListItem[];
  expenses: ExpenseListItem[];
  accounts: FinancialAccountListItem[];
  unpaidAmount: number;
  reviewedExpenseAmount: number;
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function buildAdminBillingWhere(scopes: AdminScope[]): Prisma.BillingRecordWhereInput {
  if (scopes.some((scope) => scope.allClients)) {
    return {};
  }

  const clientIds = unique(scopes.map((scope) => scope.clientId));
  const marketerIds = unique(scopes.map((scope) => scope.marketerId));
  const allMarketers = scopes.some((scope) => scope.allMarketers);
  const clauses: Prisma.BillingRecordWhereInput[] = [];

  if (clientIds.length > 0) {
    clauses.push({ clientId: { in: clientIds } });
  }

  if (allMarketers) {
    clauses.push({ client: { assignedMarketerId: { not: null } } });
  } else if (marketerIds.length > 0) {
    clauses.push({ client: { assignedMarketerId: { in: marketerIds } } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

function buildAdminExpenseWhere(scopes: AdminScope[]): Prisma.ExpenseRecordWhereInput {
  if (scopes.some((scope) => scope.allClients && scope.allMarketers)) {
    return {};
  }

  const clientIds = unique(scopes.map((scope) => scope.clientId));
  const marketerIds = unique(scopes.map((scope) => scope.marketerId));
  const allClients = scopes.some((scope) => scope.allClients);
  const allMarketers = scopes.some((scope) => scope.allMarketers);
  const clauses: Prisma.ExpenseRecordWhereInput[] = [];

  if (allClients) {
    clauses.push({ clientId: { not: null } });
  } else if (clientIds.length > 0) {
    clauses.push({ clientId: { in: clientIds } });
  }

  if (allMarketers) {
    clauses.push({ submittedById: { not: null } });
    clauses.push({ client: { assignedMarketerId: { not: null } } });
  } else if (marketerIds.length > 0) {
    clauses.push({ submittedById: { in: marketerIds } });
    clauses.push({ client: { assignedMarketerId: { in: marketerIds } } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

async function buildFinanceWhere(user: CurrentUser) {
  if (user.role === Role.SUPER_ADMIN) {
    return {
      billing: {},
      expense: {}
    };
  }

  if (user.role === Role.MARKETER) {
    return {
      billing: { client: { assignedMarketerId: user.id } },
      expense: { OR: [{ submittedById: user.id }, { client: { assignedMarketerId: user.id } }] }
    };
  }

  const scopes = await db.accessScope.findMany({
    where: { adminId: user.id },
    select: {
      clientId: true,
      marketerId: true,
      allClients: true,
      allMarketers: true
    }
  });

  return {
    billing: buildAdminBillingWhere(scopes),
    expense: buildAdminExpenseWhere(scopes)
  };
}

export async function fetchFinanceOverviewForUser(user: CurrentUser): Promise<FinanceOverview> {
  const where = await buildFinanceWhere(user);
  const [billings, expenses, accounts] = await Promise.all([
    db.billingRecord.findMany({
      where: where.billing,
      orderBy: [{ billingMonth: "desc" }, { dueDate: "asc" }],
      take: 50,
      select: {
        id: true,
        billingMonth: true,
        issuedAmount: true,
        paidAmount: true,
        status: true,
        dueDate: true,
        invoiceNumber: true,
        client: {
          select: { name: true }
        }
      }
    }),
    db.expenseRecord.findMany({
      where: where.expense,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        vendor: true,
        category: true,
        amount: true,
        paymentMethod: true,
        reviewStatus: true,
        paidAt: true,
        client: {
          select: { name: true }
        },
        financialAccount: {
          select: {
            displayName: true,
            institutionName: true,
            accountLast4: true,
            cardLast4: true
          }
        }
      }
    }),
    db.financialAccount.findMany({
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        type: true,
        displayName: true,
        institutionName: true,
        accountLast4: true,
        cardLast4: true,
        connectionStatus: true
      }
    })
  ]);

  const mappedBillings = billings.map((billing) => ({
    id: billing.id,
    clientName: billing.client.name,
    billingMonth: billing.billingMonth,
    issuedAmount: billing.issuedAmount.toNumber(),
    paidAmount: billing.paidAmount.toNumber(),
    status: billing.status,
    dueDate: billing.dueDate,
    invoiceNumber: billing.invoiceNumber
  }));
  const mappedExpenses = expenses.map((expense) => ({
    id: expense.id,
    vendor: expense.vendor,
    category: expense.category,
    clientName: expense.client?.name ?? null,
    amount: expense.amount.toNumber(),
    paymentMethod: expense.paymentMethod,
    reviewStatus: expense.reviewStatus,
    paidAt: expense.paidAt,
    accountLabel: expense.financialAccount
      ? `${expense.financialAccount.institutionName ?? expense.financialAccount.displayName} ${expense.financialAccount.accountLast4 ?? expense.financialAccount.cardLast4 ?? ""}`.trim()
      : null
  }));
  const summary = summarizeFinance({
    billings: mappedBillings,
    expenses: mappedExpenses
  });

  return {
    billings: mappedBillings,
    expenses: mappedExpenses,
    accounts,
    ...summary
  };
}

export type BankMatchSuggestion = {
  bankTxId: string;
  billingId: string;
  score: number;
  bankLabel: string;
  billingLabel: string;
};

const monthLabelFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const dateLabelFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

/**
 * 입금 반자동 대사 후보. 미확정 은행거래 × 미수 청구건을 금액/입금자명으로 스코어링.
 * 마케터는 재무 접근 불가 → 빈 배열. (BankReconcile UI에 주입)
 */
export async function getBankMatchSuggestions(user: CurrentUser): Promise<BankMatchSuggestion[]> {
  if (user.role === Role.MARKETER) {
    return [];
  }

  const [txs, billings] = await Promise.all([
    db.bankTransaction.findMany({
      where: { matchStatus: { in: ["UNMATCHED", "SUGGESTED"] } },
      orderBy: { txDate: "desc" },
      take: 50,
      select: { id: true, txDate: true, amount: true, counterpartyName: true }
    }),
    db.billingRecord.findMany({
      where: { status: { in: [BillingStatus.UNPAID, BillingStatus.PARTIALLY_PAID, BillingStatus.OVERDUE] } },
      select: {
        id: true,
        billingMonth: true,
        issuedAmount: true,
        paidAmount: true,
        client: { select: { name: true } }
      }
    })
  ]);

  if (txs.length === 0 || billings.length === 0) {
    return [];
  }

  const suggestions: BankMatchSuggestion[] = [];
  for (const tx of txs) {
    const amount = tx.amount.toNumber();
    for (const billing of billings) {
      const remaining = billing.issuedAmount.toNumber() - billing.paidAmount.toNumber();
      let score = 0;
      if (Math.abs(remaining - amount) < 1) score += 2;
      if (tx.counterpartyName && billing.client.name.includes(tx.counterpartyName)) score += 1;
      if (score === 0) continue;
      suggestions.push({
        bankTxId: tx.id,
        billingId: billing.id,
        score,
        bankLabel: `${dateLabelFormatter.format(tx.txDate)} · ${amount.toLocaleString()}원 · ${tx.counterpartyName ?? "입금자 미상"}`,
        billingLabel: `${billing.client.name} ${monthLabelFormatter.format(billing.billingMonth)} · 잔액 ${remaining.toLocaleString()}원`
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 20);
}

export type BillingForPayment = {
  id: string;
  clientName: string;
  billingMonth: string;
  invoiceNumber: string | null;
  currency: string;
  issuedAmount: number;
  paidAmount: number;
  outstanding: number;
  status: BillingStatus;
  dueDate: string | null;
};

/** 공용 결제 링크(/pay/[id])에서 쓰는 청구 정보. 접근 제어 없이 링크 소지자에게 노출. */
export async function getBillingForPayment(billingId: string): Promise<BillingForPayment | null> {
  const billing = await db.billingRecord.findUnique({
    where: { id: billingId },
    select: {
      id: true, billingMonth: true, invoiceNumber: true, currency: true,
      issuedAmount: true, paidAmount: true, status: true, dueDate: true,
      client: { select: { name: true } }
    }
  });
  if (!billing) return null;
  const issuedAmount = billing.issuedAmount.toNumber();
  const paidAmount = billing.paidAmount.toNumber();
  return {
    id: billing.id,
    clientName: billing.client.name,
    billingMonth: billing.billingMonth.toISOString().slice(0, 10),
    invoiceNumber: billing.invoiceNumber,
    currency: billing.currency,
    issuedAmount, paidAmount,
    outstanding: Math.max(0, issuedAmount - paidAmount),
    status: billing.status,
    dueDate: billing.dueDate ? billing.dueDate.toISOString().slice(0, 10) : null
  };
}

// ── 공용 결제 링크(/pay) 결제 기록 — 데모/토스 실결제 ──
function computeBillingStatus(issuedAmount: number, paidAmount: number, dueDate: Date | null, now: Date): BillingStatus {
  if (issuedAmount > 0 && paidAmount >= issuedAmount) return BillingStatus.PAID;
  if (paidAmount > 0) return BillingStatus.PARTIALLY_PAID;
  if (dueDate && dueDate.getTime() < now.getTime()) return BillingStatus.OVERDUE;
  return BillingStatus.UNPAID;
}

export async function recordDemoPayment(
  billingId: string
): Promise<{ status: BillingStatus; paidAmount: number; alreadyPaid: boolean }> {
  return db.$transaction(async (tx) => {
    const billing = await tx.billingRecord.findUniqueOrThrow({
      where: { id: billingId },
      select: { id: true, issuedAmount: true, paidAmount: true, dueDate: true }
    });
    const issuedAmount = billing.issuedAmount.toNumber();
    const currentPaid = billing.paidAmount.toNumber();
    const now = new Date();
    if (issuedAmount - currentPaid <= 0) {
      return { status: computeBillingStatus(issuedAmount, currentPaid, billing.dueDate, now), paidAmount: currentPaid, alreadyPaid: true };
    }
    await tx.paymentRecord.create({
      data: {
        billingRecordId: billingId, recordedById: null, amount: issuedAmount - currentPaid,
        method: PaymentMethod.CARD, provider: PaymentProvider.TOSSPAYMENTS,
        transactionId: "DEMO", receivedAt: now
      }
    });
    const agg = await tx.paymentRecord.aggregate({ where: { billingRecordId: billingId }, _sum: { amount: true } });
    const paidAmount = agg._sum.amount?.toNumber() ?? 0;
    const status = computeBillingStatus(issuedAmount, paidAmount, billing.dueDate, now);
    await tx.billingRecord.update({ where: { id: billingId }, data: { paidAmount, status } });
    return { status, paidAmount, alreadyPaid: false };
  });
}

export async function recordTossPayment(
  billingId: string,
  input: { amount: number; paymentKey: string; method: string | null }
): Promise<{ status: BillingStatus; paidAmount: number; duplicate: boolean }> {
  return db.$transaction(async (tx) => {
    const billing = await tx.billingRecord.findUniqueOrThrow({
      where: { id: billingId },
      select: { id: true, issuedAmount: true, dueDate: true }
    });
    const existing = await tx.paymentRecord.findFirst({
      where: { billingRecordId: billingId, providerPaymentId: input.paymentKey },
      select: { id: true }
    });
    const now = new Date();
    if (!existing) {
      await tx.paymentRecord.create({
        data: {
          billingRecordId: billingId, recordedById: null, amount: input.amount,
          method: input.method === "카드" || input.method === "CARD" ? PaymentMethod.CARD : PaymentMethod.OTHER,
          provider: PaymentProvider.TOSSPAYMENTS,
          transactionId: input.paymentKey, providerPaymentId: input.paymentKey, receivedAt: now
        }
      });
    }
    const agg = await tx.paymentRecord.aggregate({ where: { billingRecordId: billingId }, _sum: { amount: true } });
    const paidAmount = agg._sum.amount?.toNumber() ?? 0;
    const issuedAmount = billing.issuedAmount.toNumber();
    const status = computeBillingStatus(issuedAmount, paidAmount, billing.dueDate, now);
    await tx.billingRecord.update({ where: { id: billingId }, data: { paidAmount, status } });
    return { status, paidAmount, duplicate: Boolean(existing) };
  });
}
