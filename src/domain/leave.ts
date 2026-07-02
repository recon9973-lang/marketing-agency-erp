import { z } from "zod";
import { LeaveStatus, LeaveType } from "@/domain/types";
import { enumSchema, isoDateSchema, optionalString } from "@/domain/validation";

export type LeaveAction = "approve" | "reject" | "cancel";

/** 휴가 신청 입력 검증 (V2 §4). */
export const leaveRequestFormSchema = z
  .object({
    type: enumSchema(LeaveType, "휴가 유형"),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    daysRequested: z.coerce
      .number({ invalid_type_error: "신청 일수는 숫자여야 합니다." })
      .positive("신청 일수는 0보다 커야 합니다.")
      .max(366, "신청 일수가 너무 큽니다."),
    reason: optionalString(500)
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "종료일은 시작일과 같거나 이후여야 합니다.",
    path: ["endDate"]
  });

export type LeaveRequestFormInput = z.infer<typeof leaveRequestFormSchema>;

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
