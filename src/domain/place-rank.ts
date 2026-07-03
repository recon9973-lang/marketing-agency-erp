import { z } from "zod";
import { isoDateSchema, optionalString } from "@/domain/validation";

/** 플레이스 순위 기록 입력 검증 (V2 §7). */
export const placeRankFormSchema = z.object({
  clientId: z.string().trim().min(1, "거래처를 확인해주세요."),
  keyword: z
    .string({ required_error: "키워드를 입력해주세요." })
    .trim()
    .min(1, "키워드를 입력해주세요.")
    .max(100, "키워드는 100자 이내로 입력해주세요."),
  rank: z.coerce
    .number({ invalid_type_error: "순위는 숫자로 입력해주세요." })
    .int("순위는 정수로 입력해주세요.")
    .min(1, "순위는 1 이상이어야 합니다.")
    .max(999, "순위는 999 이하여야 합니다."),
  recordedOn: isoDateSchema,
  memo: optionalString(500)
});

export type PlaceRankFormInput = z.infer<typeof placeRankFormSchema>;

/**
 * 직전 기록 대비 순위 변동을 계산한다.
 * 순위 숫자가 줄어들면 상승이므로 양수(+)가 상승, 음수(-)가 하락이다.
 * 직전 기록이 없으면(신규 키워드) null을 반환한다.
 */
export function rankDelta(current: number, previous?: number | null): number | null {
  if (previous === null || previous === undefined) {
    return null;
  }

  return previous - current;
}
