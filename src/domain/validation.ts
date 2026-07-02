import { z } from "zod";

export function requiredString(label = "값", options?: { max?: number }) {
  let schema = z
    .string({ required_error: `${label}을(를) 입력해주세요.`, invalid_type_error: `${label}을(를) 입력해주세요.` })
    .trim()
    .min(1, `${label}을(를) 입력해주세요.`);

  if (options?.max) {
    schema = schema.max(options.max, `${label}은(는) ${options.max}자 이내로 입력해주세요.`);
  }

  return schema;
}

export function optionalString(options?: { max?: number }) {
  let schema = z.string().trim();

  if (options?.max) {
    schema = schema.max(options.max, `${options.max}자 이내로 입력해주세요.`);
  }

  return schema
    .optional()
    .transform((value) => (value ? value : undefined));
}

export const moneyAmountSchema = z.coerce
  .number({ invalid_type_error: "금액은 숫자로 입력해주세요." })
  .int("금액은 원 단위 정수로 입력해주세요.")
  .min(0, "금액은 0원 이상이어야 합니다.")
  .max(10_000_000_000, "금액이 허용 범위를 초과했습니다.");

export const isoDateSchema = z
  .string({ required_error: "날짜를 입력해주세요." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식으로 입력해주세요.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "존재하지 않는 날짜입니다.");

export const dateRangeSchema = z
  .object({
    startDate: isoDateSchema,
    endDate: isoDateSchema
  })
  .refine((range) => range.startDate <= range.endDate, {
    message: "종료일은 시작일보다 빠를 수 없습니다.",
    path: ["endDate"]
  });

export function enumValue<T extends [string, ...string[]]>(values: T, label = "값") {
  return z.enum(values, {
    errorMap: () => ({ message: `허용되지 않는 ${label}입니다.` })
  });
}

export function nativeEnumValue<T extends Record<string, string>>(enumObject: T, label = "값") {
  return z.nativeEnum(enumObject, {
    errorMap: () => ({ message: `허용되지 않는 ${label}입니다.` })
  });
}

export const paginationSchema = z.object({
  page: z.coerce.number().int("페이지는 정수여야 합니다.").min(1, "페이지는 1 이상이어야 합니다.").default(1),
  pageSize: z.coerce
    .number()
    .int("페이지 크기는 정수여야 합니다.")
    .min(1, "페이지 크기는 1 이상이어야 합니다.")
    .max(100, "페이지 크기는 100 이하여야 합니다.")
    .default(20)
});

export type PaginationInput = z.infer<typeof paginationSchema>;
