// V2 §1 공통 인프라 — 공통 validation schema
//
// 거래처/업무/휴가/정산/지출/보고서 입력값 검증에서 재사용할 Zod helper.
// 잘못된 입력을 server action 이전/내부에서 차단하고, field-level 오류를 UI에 표시한다.

import { z } from "zod";

// 앞뒤 공백을 제거한 문자열. 빈 문자열은 undefined 로 취급하고 싶을 때 optional 과 조합.
export function trimmedString() {
  return z.string().transform((value) => value.trim());
}

// 필수 문자열(trim 후 길이 검증).
export function requiredString(
  label = "값",
  { min = 1, max = 500 }: { min?: number; max?: number } = {}
) {
  return trimmedString().pipe(
    z
      .string()
      .min(min, `${label}은(는) 최소 ${min}자 이상이어야 합니다.`)
      .max(max, `${label}은(는) 최대 ${max}자까지 입력할 수 있습니다.`)
  );
}

// 선택 문자열(trim 후 빈 값이면 undefined).
export function optionalString({ max = 500 }: { max?: number } = {}) {
  return trimmedString()
    .pipe(z.string().max(max, `최대 ${max}자까지 입력할 수 있습니다.`))
    .transform((value) => (value === "" ? undefined : value));
}

// 금액(원): 0 이상 정수. 문자열/숫자 모두 허용(coerce).
export function amount(label = "금액", { min = 0, max = 1_000_000_000_000 }: { min?: number; max?: number } = {}) {
  return z.coerce
    .number({ invalid_type_error: `${label}은(는) 숫자여야 합니다.` })
    .int(`${label}은(는) 정수여야 합니다.`)
    .min(min, `${label}은(는) ${min} 이상이어야 합니다.`)
    .max(max, `${label}이(가) 허용 범위를 초과했습니다.`);
}

// enum: 허용 값 목록. Prisma enum 객체(Object.values)와 함께 사용.
export function enumOf<T extends string>(values: readonly [T, ...T[]], label = "값") {
  return z.enum(values, {
    errorMap: () => ({ message: `${label} 값이 올바르지 않습니다.` }),
  });
}

// 날짜 범위: start <= end. 문자열/Date 모두 허용.
export function dateRange() {
  return z
    .object({
      start: z.coerce.date(),
      end: z.coerce.date(),
    })
    .refine((v) => v.start.getTime() <= v.end.getTime(), {
      message: "시작일은 종료일보다 이후일 수 없습니다.",
      path: ["end"],
    });
}

// 목록 조회용 pagination/filter.
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;
