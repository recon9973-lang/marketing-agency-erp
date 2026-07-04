import type { Prisma } from "@prisma/client";
import {
  getBillingStatus,
  summarizeFinance,
  type BillingFormInput,
  type ExpenseFormInput,
  type PaymentFormInput
} from "@/domain/finance";
import {
  BillingStatus,
  ConnectionStatus,
  ExpenseReviewStatus,
  FinancialAccountType,
  PaymentMethod,
  PaymentProvider,
  Role
} from "@/domain/types";
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

// --- 청구/입금/지출 입력 (V2 §5) ---

function monthStart(isoDate: string) {
  return new Date(`${isoDate.slice(0, 7)}-01T00:00:00.000Z`);
}

function dayStart(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export type BillingDetail = {
  id: string;
  clientId: string;
  billingMonth: string;
  contractAmount: number;
  issuedAmount: number;
  paidAmount: number;
  status: BillingStatus;
  dueDate: string | null;
  invoiceNumber: string | null;
};

export type BillingAccessInfo = {
  id: string;
  clientId: string;
  clientAssignedMarketerId: string | null;
};

export async function getBillingAccessInfo(billingId: string): Promise<BillingAccessInfo | null> {
  const billing = await db.billingRecord.findUnique({
    where: { id: billingId },
    select: { id: true, clientId: true, client: { select: { assignedMarketerId: true } } }
  });

  if (!billing) {
    return null;
  }

  return { id: billing.id, clientId: billing.clientId, clientAssignedMarketerId: billing.client.assignedMarketerId };
}

export async function getBillingDetail(billingId: string): Promise<BillingDetail | null> {
  const billing = await db.billingRecord.findUnique({
    where: { id: billingId },
    select: {
      id: true,
      clientId: true,
      billingMonth: true,
      contractAmount: true,
      issuedAmount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
      invoiceNumber: true
    }
  });

  if (!billing) {
    return null;
  }

  return {
    id: billing.id,
    clientId: billing.clientId,
    billingMonth: billing.billingMonth.toISOString().slice(0, 10),
    contractAmount: billing.contractAmount.toNumber(),
    issuedAmount: billing.issuedAmount.toNumber(),
    paidAmount: billing.paidAmount.toNumber(),
    status: billing.status,
    dueDate: billing.dueDate ? billing.dueDate.toISOString().slice(0, 10) : null,
    invoiceNumber: billing.invoiceNumber
  };
}

export async function createBillingRecord(input: BillingFormInput, issuedById: string): Promise<{ id: string }> {
  const dueDate = input.dueDate ? dayStart(input.dueDate) : null;
  const status = getBillingStatus({ issuedAmount: input.issuedAmount, paidAmount: 0, dueDate }, new Date());

  return db.billingRecord.create({
    data: {
      clientId: input.clientId,
      issuedById,
      billingMonth: monthStart(input.billingMonth),
      contractAmount: input.contractAmount,
      issuedAmount: input.issuedAmount,
      dueDate,
      invoiceNumber: input.invoiceNumber ?? null,
      status,
      issuedAt: new Date()
    },
    select: { id: true }
  });
}

export async function updateBillingRecord(billingId: string, input: BillingFormInput): Promise<{ id: string }> {
  const current = await db.billingRecord.findUniqueOrThrow({
    where: { id: billingId },
    select: { paidAmount: true }
  });
  const dueDate = input.dueDate ? dayStart(input.dueDate) : null;
  const status = getBillingStatus(
    { issuedAmount: input.issuedAmount, paidAmount: current.paidAmount.toNumber(), dueDate },
    new Date()
  );

  return db.billingRecord.update({
    where: { id: billingId },
    data: {
      clientId: input.clientId,
      billingMonth: monthStart(input.billingMonth),
      contractAmount: input.contractAmount,
      issuedAmount: input.issuedAmount,
      dueDate,
      invoiceNumber: input.invoiceNumber ?? null,
      status
    },
    select: { id: true }
  });
}

/**
 * 입금을 기록하고 청구의 입금 합계/상태를 재계산한다(트랜잭션).
 */
export async function recordPayment(
  input: PaymentFormInput,
  recordedById: string
): Promise<{ id: string; billingId: string; paidAmount: number; status: BillingStatus }> {
  return db.$transaction(async (tx) => {
    const billing = await tx.billingRecord.findUniqueOrThrow({
      where: { id: input.billingRecordId },
      select: { id: true, issuedAmount: true, dueDate: true }
    });

    const payment = await tx.paymentRecord.create({
      data: {
        billingRecordId: input.billingRecordId,
        recordedById,
        amount: input.amount,
        method: input.method,
        transactionId: input.transactionId ?? null,
        receivedAt: dayStart(input.receivedAt)
      },
      select: { id: true }
    });

    const aggregate = await tx.paymentRecord.aggregate({
      where: { billingRecordId: input.billingRecordId },
      _sum: { amount: true }
    });
    const paidAmount = aggregate._sum.amount?.toNumber() ?? 0;
    const status = getBillingStatus(
      { issuedAmount: billing.issuedAmount.toNumber(), paidAmount, dueDate: billing.dueDate },
      new Date()
    );

    await tx.billingRecord.update({
      where: { id: billing.id },
      data: { paidAmount, status }
    });

    return { id: payment.id, billingId: billing.id, paidAmount, status };
  });
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
      id: true,
      billingMonth: true,
      invoiceNumber: true,
      currency: true,
      issuedAmount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
      client: { select: { name: true } }
    }
  });

  if (!billing) {
    return null;
  }

  const issuedAmount = billing.issuedAmount.toNumber();
  const paidAmount = billing.paidAmount.toNumber();

  return {
    id: billing.id,
    clientName: billing.client.name,
    billingMonth: billing.billingMonth.toISOString().slice(0, 10),
    invoiceNumber: billing.invoiceNumber,
    currency: billing.currency,
    issuedAmount,
    paidAmount,
    outstanding: Math.max(0, issuedAmount - paidAmount),
    status: billing.status,
    dueDate: billing.dueDate ? billing.dueDate.toISOString().slice(0, 10) : null
  };
}

/**
 * 데모 결제: 남은 금액을 카드로 결제한 것으로 기록한다(실 결제 미연동 시).
 * recordedById는 공용 링크라 null. transactionId로 데모임을 표시.
 */
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
    const outstanding = issuedAmount - currentPaid;

    if (outstanding <= 0) {
      const status = getBillingStatus({ issuedAmount, paidAmount: currentPaid, dueDate: billing.dueDate }, new Date());
      return { status, paidAmount: currentPaid, alreadyPaid: true };
    }

    await tx.paymentRecord.create({
      data: {
        billingRecordId: billingId,
        recordedById: null,
        amount: outstanding,
        method: PaymentMethod.CARD,
        provider: PaymentProvider.TOSSPAYMENTS,
        transactionId: "DEMO",
        receivedAt: new Date()
      }
    });

    const aggregate = await tx.paymentRecord.aggregate({
      where: { billingRecordId: billingId },
      _sum: { amount: true }
    });
    const paidAmount = aggregate._sum.amount?.toNumber() ?? 0;
    const status = getBillingStatus({ issuedAmount, paidAmount, dueDate: billing.dueDate }, new Date());

    await tx.billingRecord.update({ where: { id: billingId }, data: { paidAmount, status } });

    return { status, paidAmount, alreadyPaid: false };
  });
}

export type ExpenseAccessInfo = {
  id: string;
  clientId: string | null;
  clientAssignedMarketerId: string | null;
};

export async function getExpenseAccessInfo(expenseId: string): Promise<ExpenseAccessInfo | null> {
  const expense = await db.expenseRecord.findUnique({
    where: { id: expenseId },
    select: { id: true, clientId: true, client: { select: { assignedMarketerId: true } } }
  });

  if (!expense) {
    return null;
  }

  return { id: expense.id, clientId: expense.clientId, clientAssignedMarketerId: expense.client?.assignedMarketerId ?? null };
}

export async function createExpenseRecord(input: ExpenseFormInput, submittedById: string): Promise<{ id: string }> {
  return db.expenseRecord.create({
    data: {
      clientId: input.clientId ?? null,
      submittedById,
      category: input.category,
      vendor: input.vendor ?? null,
      amount: input.amount,
      taxAmount: input.taxAmount ?? null,
      paymentMethod: input.paymentMethod,
      memo: input.memo ?? null,
      paidAt: input.paidAt ? dayStart(input.paidAt) : null
    },
    select: { id: true }
  });
}

export type ExpenseReviewData = {
  reviewStatus: ExpenseReviewStatus;
  reviewedById: string;
  reviewedAt: Date;
  excludedReason?: string | null;
};

export async function reviewExpenseRecord(
  expenseId: string,
  data: ExpenseReviewData
): Promise<{ id: string; reviewStatus: ExpenseReviewStatus }> {
  return db.expenseRecord.update({
    where: { id: expenseId },
    data: {
      reviewStatus: data.reviewStatus,
      reviewedById: data.reviewedById,
      reviewedAt: data.reviewedAt,
      excludedReason: data.excludedReason ?? null
    },
    select: { id: true, reviewStatus: true }
  });
}
