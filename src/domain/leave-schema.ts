import { z } from "zod";
import { LeaveType } from "./types";
import { isoDateSchema, nativeEnumValue, optionalString } from "./validation";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const leaveRequestInputSchema = z
  .object({
    type: nativeEnumValue(LeaveType, "휴가 유형"),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    daysRequested: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({
          required_error: "신청 일수를 입력해주세요.",
          invalid_type_error: "신청 일수는 숫자로 입력해주세요."
        })
        .multipleOf(0.5, "신청 일수는 0.5일 단위로 입력해주세요.")
        .min(0.5, "신청 일수는 0.5일 이상이어야 합니다.")
        .max(30, "신청 일수는 30일 이하여야 합니다.")
    ),
    reason: optionalString({ max: 500 })
  })
  .refine((input) => input.startDate <= input.endDate, {
    message: "종료일은 시작일보다 빠를 수 없습니다.",
    path: ["endDate"]
  });

export type LeaveRequestInput = z.infer<typeof leaveRequestInputSchema>;

export const leaveDecisionSchema = z.object({
  action: z.enum(["approve", "reject"], {
    errorMap: () => ({ message: "허용되지 않는 처리입니다." })
  }),
  approvalNotes: optionalString({ max: 500 })
});

export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;
