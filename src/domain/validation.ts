/**
 * 공통 validation schema (V2 §1).
 *
 * 거래처, 업무, 휴가, 정산, 지출, 보고서 입력값 검증을 일관되게 처리하기 위한
 * 재사용 가능한 Zod 빌딩 블록. server action 진입부에서 `schema.parse(input)`로
 * 사용하고, 실패 시 `ZodError`가 `fieldErrorsFromZod`를 통해 field 오류로 변환된다.
 */
import { z } from "zod";

/** 앞뒤 공백을 제거한 필수 문자열. */
export function requiredString(label = "값", max = 500) {
  return z
    .string({ required_error: `${label}을(를) 입력해주세요.`, invalid_type_error: `${label} 형식이 올바르지 않습니다.` })
    .trim()
    .min(1, `${label}을(를) 입력해주세요.`)
    .max(max, `${label}은(는) 최대 ${max}자까지 입력할 수 있습니다.`);
}

/** 앞뒤 공백을 제거한 선택 문자열. 빈 문자열은 undefined로 정규화한다. */
export function optionalString(max = 500) {
  return z
    .string()
    .trim()
    .max(max, `최대 ${max}자까지 입력할 수 있습니다.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

/** cuid 식별자. */
export const idSchema = z.string().trim().min(1, "식별자가 필요합니다.");

/**
 * 금액(원 단위). 문자열/숫자 입력을 숫자로 변환하고 음수가 아닌 정수만 허용한다.
 */
export function amountSchema(label = "금액") {
  return z.coerce
    .number({ invalid_type_error: `${label}은(는) 숫자여야 합니다.` })
    .int(`${label}은(는) 원 단위 정수여야 합니다.`)
    .min(0, `${label}은(는) 0 이상이어야 합니다.`)
    .finite(`${label}이(가) 올바르지 않습니다.`);
}

/** ISO 날짜(YYYY-MM-DD) 문자열. */
export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "유효한 날짜가 아닙니다.");

/**
 * 시작/종료 날짜 범위. 종료일은 시작일과 같거나 이후여야 한다.
 */
export const dateRangeSchema = z
  .object({
    startDate: isoDateSchema,
    endDate: isoDateSchema
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "종료일은 시작일과 같거나 이후여야 합니다.",
    path: ["endDate"]
  });

/**
 * Prisma native enum 값 검증 schema.
 * 예: `enumSchema(WorkStatus, "업무 상태")`
 */
export function enumSchema<T extends Record<string, string>>(enumObject: T, label = "값") {
  return z.nativeEnum(enumObject, {
    errorMap: () => ({ message: `유효한 ${label}이(가) 아닙니다.` })
  });
}

/**
 * 목록 조회용 pagination 검증. 기본값을 채우고 상한을 강제한다.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export type Pagination = z.infer<typeof paginationSchema>;
