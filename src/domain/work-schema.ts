import { z } from "zod";
import { WorkCategory } from "./types";
import { isoDateSchema, nativeEnumValue, optionalString, requiredString } from "./validation";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const workItemInputSchema = z.object({
  title: requiredString("업무명", { max: 150 }),
  clientId: requiredString("거래처"),
  ownerId: requiredString("담당자"),
  category: nativeEnumValue(WorkCategory, "업무 카테고리"),
  priority: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: "우선순위는 숫자로 입력해주세요." })
      .int("우선순위는 정수여야 합니다.")
      .min(1, "우선순위는 1~5 사이여야 합니다.")
      .max(5, "우선순위는 1~5 사이여야 합니다.")
      .default(3)
  ),
  dueDate: z.preprocess(emptyToUndefined, isoDateSchema.optional()),
  progressNotes: optionalString({ max: 2000 })
});

export type WorkItemInput = z.infer<typeof workItemInputSchema>;

export const workStatusActions = ["start", "submit_for_review", "approve", "block", "resume"] as const;

export const workStatusActionSchema = z.enum(workStatusActions, {
  errorMap: () => ({ message: "허용되지 않는 상태 변경입니다." })
});
