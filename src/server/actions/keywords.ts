"use server";

/**
 * 검색량 조회 server action (워크플로우 7차 · 18차 DataLab 연동).
 * 로그인한 직원 누구나 조회 가능. 소스 우선순위:
 *   1) 검색광고 키(NAVER_AD_*) → 절대 월간검색수
 *   2) 데이터랩 키(NAVER_CLIENT_*) → 검색어 트렌드(0~100)
 *   3) 없으면 데모 추정치
 */
import { keywordLookupSchema, parseKeywords } from "@/domain/keywords";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireCurrentUser } from "@/server/authorization";
import { validationError } from "@/server/errors";
import { fetchKeywordTrends, naverDatalabConfigured, type KeywordTrend } from "@/server/integrations/naver-datalab";
import { fetchKeywordVolumes, naverSearchConfigured, type KeywordVolume } from "@/server/integrations/naver-search";

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

export type KeywordLookupData =
  | { mode: "volume"; source: "searchad" | "demo"; volume: KeywordVolume[] }
  | { mode: "trend"; source: "datalab"; trend: KeywordTrend[] };

export type KeywordLookupState = ActionResult<KeywordLookupData>;

export async function lookupKeywordVolumeAction(
  _prevState: KeywordLookupState | null,
  formData: FormData
): Promise<KeywordLookupState> {
  return runAction(async (): Promise<KeywordLookupData> => {
    await requireCurrentUser();
    const { keywords } = keywordLookupSchema.parse(formDataToObject(formData));

    const list = parseKeywords(keywords);
    if (list.length === 0) {
      throw validationError("키워드를 입력해주세요.", { keywords: ["키워드를 입력해주세요."] });
    }

    // 검색광고(절대 검색수)가 있으면 우선.
    if (naverSearchConfigured()) {
      return { mode: "volume", source: "searchad", volume: await fetchKeywordVolumes(list) };
    }

    // 데이터랩(트렌드)이 연동돼 있으면 실트렌드.
    if (naverDatalabConfigured()) {
      return { mode: "trend", source: "datalab", trend: await fetchKeywordTrends(list) };
    }

    // 둘 다 없으면 데모 추정치.
    return { mode: "volume", source: "demo", volume: await fetchKeywordVolumes(list) };
  });
}
