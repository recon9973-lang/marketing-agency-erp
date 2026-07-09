import { z } from "zod";

/** 검색량 조회 입력 검증 (워크플로우 7차). 쉼표/줄바꿈으로 여러 키워드. */
export const keywordLookupSchema = z.object({
  keywords: z
    .string({ required_error: "키워드를 입력해주세요." })
    .trim()
    .min(1, "키워드를 입력해주세요.")
    .max(300, "키워드는 300자 이내로 입력해주세요.")
});

/** 원문을 개별 키워드 배열로 분리(최대 5개). */
export function parseKeywords(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 5);
}
