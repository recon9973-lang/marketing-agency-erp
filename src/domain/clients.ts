/**
 * 거래처(Client) 입력 검증 (V2 §2).
 *
 * 거래처 생성/수정 server action이 공유하는 Zod 스키마. §1 공통 validation 빌딩
 * 블록을 재사용하고, 빈 문자열은 undefined로 정규화해 선택 입력을 일관되게 다룬다.
 */
import { z } from "zod";
import { amountSchema, isoDateSchema, optionalString, requiredString } from "@/domain/validation";

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다.").max(200).optional()
);

const optionalIsoDate = z.preprocess(emptyToUndefined, isoDateSchema.optional());

const optionalAmount = z.preprocess(emptyToUndefined, amountSchema("월 계약금").optional());

const optionalAssignee = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(60).optional()
);

/** 체크박스/문자열/불리언 입력을 boolean으로 정규화. 기본값 true(운영중). */
const activeSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "on" || value === "1";
}, z.boolean());

export const clientFormSchema = z
  .object({
    name: requiredString("거래처명", 200),
    code: requiredString("거래처 코드", 50),
    businessNumber: optionalString(50),
    contactName: optionalString(100),
    contactEmail: optionalEmail,
    contactPhone: optionalString(50),
    contractStartDate: optionalIsoDate,
    contractEndDate: optionalIsoDate,
    monthlyContractFee: optionalAmount,
    serviceNotes: optionalString(2000),
    active: activeSchema,
    assignedMarketerId: optionalAssignee
  })
  .refine(
    (value) =>
      !value.contractStartDate ||
      !value.contractEndDate ||
      value.contractStartDate <= value.contractEndDate,
    { message: "계약 종료일은 시작일과 같거나 이후여야 합니다.", path: ["contractEndDate"] }
  );

export type ClientFormInput = z.infer<typeof clientFormSchema>;
