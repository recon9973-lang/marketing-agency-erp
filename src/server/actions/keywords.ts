"use server";

/**
 * 검색량 조회 server action (워크플로우 7차).
 * 로그인한 직원 누구나 조회 가능. 미연동 시 데모 추정치를 반환한다.
 */
import { keywordLookupSchema, parseKeywords } from "@/domain/keywords";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireCurrentUser } from "@/server/authorization";
import { validationError } from "@/server/errors";
import { fetchKeywordVolumes, naverSearchConfigured, type KeywordVolume } from "@/server/integrations/naver-search";

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

export type KeywordLookupState = ActionResult<{ results: KeywordVolume[]; configured: boolean }>;

export async function lookupKeywordVolumeAction(
  _prevState: KeywordLookupState | null,
  formData: FormData
): Promise<KeywordLookupState> {
  return runAction(async () => {
    await requireCurrentUser();
    const { keywords } = keywordLookupSchema.parse(formDataToObject(formData));

    const list = parseKeywords(keywords);
    if (list.length === 0) {
      throw validationError("키워드를 입력해주세요.", { keywords: ["키워드를 입력해주세요."] });
    }

    const results = await fetchKeywordVolumes(list);
    return { results, configured: naverSearchConfigured() };
  });
}
