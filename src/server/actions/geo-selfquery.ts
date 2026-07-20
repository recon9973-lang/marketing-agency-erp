"use server";

/**
 * GEO 자체 조회 — 거래처(계약) 없이 업체명 + 키워드만으로 즉시 GEO 스냅샷을 낸다.
 * 계약 단계에서 이어받는 흐름과 별개로, 담당자가 빠르게 자체 진단할 수 있게 한다.
 * 거래처 레코드가 필요 없는 3종(키워드 확장·CEP 군집·검색 여정)만 실행한다.
 */
import { runAction, type ActionResult } from "@/server/action-result";
import { requireUser } from "@/server/actions/_helpers";
import { validationError } from "@/server/errors";
import { fetchKeywordExpansion, type KeywordFull } from "@/server/integrations/naver-search";
import { discoverCepsLive, cepRealConfigured } from "@/server/geo-studio/cep/live-finder";
import { discoverCeps } from "@/server/geo-studio/cep/finder";
import { analyzeJourney, analyzeJourneyLive, type JourneyReport } from "@/server/geo-studio/path/analyzer";
import type { BubbleCep } from "@/components/geo-cep/ClusterBubbleMap";

export type GeoSelfQueryResult = {
  brand: string;
  keyword: string;
  keywords: KeywordFull[];
  keywordConnected: boolean;
  ceps: BubbleCep[];
  cepTier: "measured" | "demo";
  cepNote: string | null;
  journey: JourneyReport | null;
  journeyTier: "approx" | "demo";
};

export async function runGeoSelfQuery(
  input: { brand: string; keyword: string }
): Promise<ActionResult<GeoSelfQueryResult>> {
  return runAction(async () => {
    await requireUser();
    const brand = String(input?.brand ?? "").trim();
    const keyword = String(input?.keyword ?? "").trim();
    if (!brand || !keyword) {
      throw validationError("업체명과 키워드를 모두 입력해주세요.", {});
    }

    // 1) 키워드 확장(검색량 + 연관키워드)
    const kw = await fetchKeywordExpansion([keyword]).catch(() => ({ rows: [], connected: false, truncated: 0 }));

    // 2) CEP 군집 — 실측(연동) 우선, 미연동 시 데모.
    let ceps: BubbleCep[] = [];
    let cepTier: "measured" | "demo" = "demo";
    let cepNote: string | null = null;
    const live = cepRealConfigured()
      ? await discoverCepsLive(brand, keyword, { seedKeyword: keyword }).catch(() => null)
      : null;
    if (live && Array.isArray(live.ceps) && live.ceps.length > 0) {
      ceps = live.ceps as unknown as BubbleCep[];
      cepTier = live.data_tier === "measured" ? "measured" : "demo";
      cepNote = live.note ?? null;
    } else {
      const mock = discoverCeps(brand, keyword, {}) as { ceps?: unknown[] };
      ceps = ((mock?.ceps ?? []) as unknown) as BubbleCep[];
      cepTier = "demo";
      cepNote = "네이버 연관어·임베딩 미연결 — 데모 군집입니다. 연동 시 실측으로 바뀝니다.";
    }

    // 3) 검색 여정 — 근사(연관어 인접) 우선, 실패 시 데모.
    let journey: JourneyReport | null = null;
    let journeyTier: "approx" | "demo" = "demo";
    const liveJourney = await analyzeJourneyLive(brand, keyword).catch(() => null);
    if (liveJourney) {
      journey = liveJourney;
      journeyTier = "approx";
    } else {
      journey = analyzeJourney(brand, keyword);
      journeyTier = "demo";
    }

    return {
      brand,
      keyword,
      keywords: kw.rows.slice(0, 30),
      keywordConnected: kw.connected,
      ceps,
      cepTier,
      cepNote,
      journey,
      journeyTier
    };
  });
}
