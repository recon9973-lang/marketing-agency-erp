import { BillingStatus, WorkStatus } from "@/domain/types";

type NumericAmount = number | string | { toNumber: () => number };

export type DashboardWorkItem = {
  status: WorkStatus;
  dueDate?: Date | string | null;
  category?: string;
  clientId?: string;
};

export type DashboardBilling = {
  status: BillingStatus;
  issuedAmount: NumericAmount;
  paidAmount: NumericAmount;
};

export type DashboardExpense = {
  amount: NumericAmount;
};

export type DashboardLeaveRequest = {
  status: string;
};

export type DashboardInput = {
  workItems: DashboardWorkItem[];
  billings: DashboardBilling[];
  expenses: DashboardExpense[];
  leaveRequests: DashboardLeaveRequest[];
  today?: Date | string;
  assignedClientCount?: number;
  leaveBalanceDays?: number;
};

export type DashboardSummary = {
  totalWorkCount: number;
  delayedWorkCount: number;
  reviewNeededWorkCount: number;
  todayWorkCount: number;
  reportTaskCount: number;
  upcomingDeadlineCount: number;
  unpaidAmount: number;
  expenseTotal: number;
  pendingLeaveCount: number;
  assignedClientCount: number;
  leaveBalanceDays: number;
};

const completedStatuses = new Set<WorkStatus>([WorkStatus.COMPLETED]);
const billingsExcludedFromUnpaid = new Set<BillingStatus>([
  BillingStatus.DRAFT,
  BillingStatus.PAID,
  BillingStatus.CANCELED
]);

function toNumber(amount: NumericAmount): number {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") return Number(amount);
  return amount.toNumber();
}

function toDateOnly(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function isPastDue(workItem: DashboardWorkItem, today: Date | string) {
  if (!workItem.dueDate || completedStatuses.has(workItem.status)) {
    return false;
  }

  return toDateOnly(workItem.dueDate) < toDateOnly(today);
}

function isDueToday(workItem: DashboardWorkItem, today: Date | string) {
  if (!workItem.dueDate || completedStatuses.has(workItem.status)) {
    return false;
  }

  return toDateOnly(workItem.dueDate) === toDateOnly(today);
}

function isUpcoming(workItem: DashboardWorkItem, today: Date | string) {
  if (!workItem.dueDate || completedStatuses.has(workItem.status)) {
    return false;
  }

  return toDateOnly(workItem.dueDate) >= toDateOnly(today);
}

export function summarizeDashboard(input: DashboardInput): DashboardSummary {
  const today = input.today ?? new Date();

  return {
    totalWorkCount: input.workItems.length,
    delayedWorkCount: input.workItems.filter((item) => isPastDue(item, today)).length,
    reviewNeededWorkCount: input.workItems.filter((item) => item.status === WorkStatus.REVIEW_NEEDED).length,
    todayWorkCount: input.workItems.filter((item) => isDueToday(item, today)).length,
    reportTaskCount: input.workItems.filter((item) => item.category === "MONTHLY_REPORT").length,
    upcomingDeadlineCount: input.workItems.filter((item) => isUpcoming(item, today)).length,
    unpaidAmount: input.billings.reduce((sum, billing) => {
      if (billingsExcludedFromUnpaid.has(billing.status)) {
        return sum;
      }

      return sum + Math.max(toNumber(billing.issuedAmount) - toNumber(billing.paidAmount), 0);
    }, 0),
    expenseTotal: input.expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0),
    pendingLeaveCount: input.leaveRequests.filter((request) => request.status === "REQUESTED").length,
    assignedClientCount: input.assignedClientCount ?? 0,
    leaveBalanceDays: input.leaveBalanceDays ?? 0
  };
}
