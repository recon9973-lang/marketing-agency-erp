/**
 * 도메인 상태 -> 배지 표시(label + tone) 매핑 (V2 §1).
 *
 * 화면마다 흩어진 상태 색상/문구를 한 곳에서 관리한다. UI의 `StatusBadge`는
 * tone만 알고 색을 입히며, 도메인 의미(label/tone)는 이 모듈이 책임진다.
 */
import {
  BillingStatus,
  ExpenseReviewStatus,
  LeaveStatus,
  ReportStatus,
  WorkStatus
} from "@/domain/types";
import { billingStatusLabels, expenseReviewStatusLabels } from "@/domain/finance";
import { leaveStatusLabels } from "@/domain/leave";
import { workStatusLabels } from "@/domain/work";

export type BadgeTone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

export type StatusDisplay = {
  label: string;
  tone: BadgeTone;
};

export const workStatusTones: Record<WorkStatus, BadgeTone> = {
  [WorkStatus.NOT_STARTED]: "neutral",
  [WorkStatus.IN_PROGRESS]: "progress",
  [WorkStatus.WAITING]: "warning",
  [WorkStatus.REVIEW_NEEDED]: "warning",
  [WorkStatus.COMPLETED]: "success",
  [WorkStatus.BLOCKED]: "danger"
};

export const billingStatusTones: Record<BillingStatus, BadgeTone> = {
  [BillingStatus.DRAFT]: "neutral",
  [BillingStatus.ISSUED]: "info",
  [BillingStatus.UNPAID]: "warning",
  [BillingStatus.PARTIALLY_PAID]: "warning",
  [BillingStatus.PAID]: "success",
  [BillingStatus.OVERDUE]: "danger",
  [BillingStatus.CANCELED]: "neutral"
};

export const leaveStatusTones: Record<LeaveStatus, BadgeTone> = {
  [LeaveStatus.REQUESTED]: "warning",
  [LeaveStatus.APPROVED]: "success",
  [LeaveStatus.REJECTED]: "danger",
  [LeaveStatus.CANCELED]: "neutral"
};

export const expenseReviewStatusTones: Record<ExpenseReviewStatus, BadgeTone> = {
  [ExpenseReviewStatus.UNREVIEWED]: "warning",
  [ExpenseReviewStatus.REVIEWED]: "success",
  [ExpenseReviewStatus.EXCLUDED]: "neutral",
  [ExpenseReviewStatus.NEEDS_FOLLOW_UP]: "danger"
};

export const reportStatusLabels: Record<ReportStatus, string> = {
  [ReportStatus.DRAFT]: "작성중",
  [ReportStatus.REVIEW_NEEDED]: "검토필요",
  [ReportStatus.APPROVED]: "승인",
  [ReportStatus.DELIVERED]: "전달완료"
};

export const reportStatusTones: Record<ReportStatus, BadgeTone> = {
  [ReportStatus.DRAFT]: "neutral",
  [ReportStatus.REVIEW_NEEDED]: "warning",
  [ReportStatus.APPROVED]: "success",
  [ReportStatus.DELIVERED]: "info"
};

export function workStatusDisplay(status: WorkStatus): StatusDisplay {
  return { label: workStatusLabels[status], tone: workStatusTones[status] };
}

export function billingStatusDisplay(status: BillingStatus): StatusDisplay {
  return { label: billingStatusLabels[status], tone: billingStatusTones[status] };
}

export function leaveStatusDisplay(status: LeaveStatus): StatusDisplay {
  return { label: leaveStatusLabels[status], tone: leaveStatusTones[status] };
}

export function expenseReviewStatusDisplay(status: ExpenseReviewStatus): StatusDisplay {
  return { label: expenseReviewStatusLabels[status], tone: expenseReviewStatusTones[status] };
}

export function reportStatusDisplay(status: ReportStatus): StatusDisplay {
  return { label: reportStatusLabels[status], tone: reportStatusTones[status] };
}
