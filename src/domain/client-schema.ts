import { z } from "zod";
import { isoDateSchema, moneyAmountSchema, optionalString, requiredString } from "./validation";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const clientInputSchema = z
  .object({
    name: requiredString("거래처명", { max: 100 }),
    code: requiredString("거래처 코드", { max: 30 }).regex(
      /^[A-Za-z0-9-]+$/,
      "거래처 코드는 영문, 숫자, 하이픈만 사용할 수 있습니다."
    ),
    businessNumber: optionalString({ max: 20 }),
    contactName: optionalString({ max: 50 }),
    contactEmail: z.preprocess(
      emptyToUndefined,
      z.string().trim().email("연락 이메일 형식이 올바르지 않습니다.").optional()
    ),
    contactPhone: optionalString({ max: 30 }),
    contractStartDate: z.preprocess(emptyToUndefined, isoDateSchema.optional()),
    contractEndDate: z.preprocess(emptyToUndefined, isoDateSchema.optional()),
    monthlyContractFee: z.preprocess(emptyToUndefined, moneyAmountSchema.optional()),
    serviceNotes: optionalString({ max: 2000 }),
    assignedMarketerId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    active: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean())
  })
  .refine(
    (input) =>
      !input.contractStartDate || !input.contractEndDate || input.contractStartDate <= input.contractEndDate,
    { message: "계약 종료일은 시작일보다 빠를 수 없습니다.", path: ["contractEndDate"] }
  );

export type ClientInput = z.infer<typeof clientInputSchema>;
