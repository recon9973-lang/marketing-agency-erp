import { LeaveStatus, LeaveType } from "@/domain/types";

export type LeaveAction = "approve" | "reject" | "cancel";

export type LeaveUsage = {
  days: number;
  status: LeaveStatus;
};

const transitionMap: Record<LeaveAction, Partial<Record<LeaveStatus, LeaveStatus>>> = {
  approve: {
    [LeaveStatus.REQUESTED]: LeaveStatus.APPROVED
  },
  reject: {
    [LeaveStatus.REQUESTED]: LeaveStatus.REJECTED
  },
  cancel: {
    [LeaveStatus.REQUESTED]: LeaveStatus.CANCELED,
    [LeaveStatus.APPROVED]: LeaveStatus.CANCELED
  }
};

export const leaveTypeLabels: Record<LeaveType, string> = {
  [LeaveType.ANNUAL]: "연차",
  [LeaveType.HALF_DAY_AM]: "오전 반차",
  [LeaveType.HALF_DAY_PM]: "오후 반차",
  [LeaveType.SICK]: "병가",
  [LeaveType.OTHER]: "기타"
};

export const leaveStatusLabels: Record<LeaveStatus, string> = {
  [LeaveStatus.REQUESTED]: "승인대기",
  [LeaveStatus.APPROVED]: "승인",
  [LeaveStatus.REJECTED]: "반려",
  [LeaveStatus.CANCELED]: "취소"
};

export function calculateRemainingLeave(allowanceDays: number, requests: LeaveUsage[]) {
  return requests.reduce(
    (remaining, request) => (request.status === LeaveStatus.APPROVED ? remaining - request.days : remaining),
    allowanceDays
  );
}

export function transitionLeave(currentStatus: LeaveStatus, action: LeaveAction) {
  return transitionMap[action][currentStatus] ?? currentStatus;
}
