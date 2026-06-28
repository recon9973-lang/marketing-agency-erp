import { BillingStatus, LeaveStatus, WorkCategory, WorkStatus } from "@/domain/types";

type NumericAmount = number | string | { toNumber: () => number };

export type DashboardWorkItem = {
  status: WorkStatus;
  dueDate?: Date | string | null;
  category?: WorkCategory;
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
  status: LeaveStatus;
};

export type DashboardInput = {
  workItems: DashboardWorkItem[];
  billings: DashboardBilling[];
  expenses: DashboardExpense[];
  leaveRequests: DashboardLeaveRequest[];
  today?: Date | string;
  timeZone?: string;
  assignedClientCount?: number;
  leaveBalanceDays?: number;
};

const defaultTimeZone = "Asia/Seoul";

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

function toCents(amount: NumericAmount): number {
  const normalized = typeof amount === "string" ? amount : toNumber(amount).toString();
  const sign = normalized.trim().startsWith("-") ? -1 : 1;
  const unsigned = normalized.trim().replace(/^-/, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const cents = `${fraction}00`.slice(0, 2);

  return sign * (Number.parseInt(whole, 10) * 100 + Number.parseInt(cents, 10));
}

function centsToNumber(cents: number): number {
  return cents / 100;
}

function formatDatePart(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function toDateOnly(value: Date | string, timeZone: string): string {
  if (value instanceof Date) {
    return formatDatePart(value, timeZone);
  }

  return value.slice(0, 10);
}

function isPastDue(workItem: DashboardWorkItem, today: Date | string, timeZone: string) {
  if (!workItem.dueDate || completedStatuses.has(workItem.status)) {
    return false;
  }

  return toDateOnly(workItem.dueDate, timeZone) < toDateOnly(today, timeZone);
}

function isDueToday(workItem: DashboardWorkItem, today: Date | string, timeZone: string) {
  if (!workItem.dueDate || completedStatuses.has(workItem.status)) {
    return false;
  }

  return toDateOnly(workItem.dueDate, timeZone) === toDateOnly(today, timeZone);
}

function isUpcoming(workItem: DashboardWorkItem, today: Date | string, timeZone: string) {
  if (!workItem.dueDate || completedStatuses.has(workItem.status)) {
    return false;
  }

  return toDateOnly(workItem.dueDate, timeZone) >= toDateOnly(today, timeZone);
}

export function summarizeDashboard(input: DashboardInput): DashboardSummary {
  const today = input.today;
  const timeZone = input.timeZone ?? defaultTimeZone;

  if (!today) {
    throw new Error("DASHBOARD_TODAY_REQUIRED");
  }

  return {
    totalWorkCount: input.workItems.length,
    delayedWorkCount: input.workItems.filter((item) => isPastDue(item, today, timeZone)).length,
    reviewNeededWorkCount: input.workItems.filter((item) => item.status === WorkStatus.REVIEW_NEEDED).length,
    todayWorkCount: input.workItems.filter((item) => isDueToday(item, today, timeZone)).length,
    reportTaskCount: input.workItems.filter((item) => item.category === WorkCategory.MONTHLY_REPORT).length,
    upcomingDeadlineCount: input.workItems.filter((item) => isUpcoming(item, today, timeZone)).length,
    unpaidAmount: centsToNumber(input.billings.reduce((sum, billing) => {
      if (billingsExcludedFromUnpaid.has(billing.status)) {
        return sum;
      }

      return sum + Math.max(toCents(billing.issuedAmount) - toCents(billing.paidAmount), 0);
    }, 0)),
    expenseTotal: centsToNumber(input.expenses.reduce((sum, expense) => sum + toCents(expense.amount), 0)),
    pendingLeaveCount: input.leaveRequests.filter((request) => request.status === LeaveStatus.REQUESTED).length,
    assignedClientCount: input.assignedClientCount ?? 0,
    leaveBalanceDays: input.leaveBalanceDays ?? 0
  };
}
