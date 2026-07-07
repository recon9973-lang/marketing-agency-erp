// src/server/marketing/providers/higgsfield.ts
//
// Higgsfield 크리에이티브 provider(SNS 이미지/숏폼/바이럴 예측).
//
// 두 경로(기획서 §2.2):
//   - 에이전트 경로(1순위): 스튜디오 UI에서 Claude가 MCP 도구를 직접 호출한다.
//       이미지        → generate_image
//       숏폼/영상     → generate_video / shorts_studio_create
//       바이럴 예측   → virality_predictor
//     (MCP는 세션 인증을 사용하므로 서버 크론에서는 못 쓴다.)
//   - 서버 경로(선택): HIGGSFIELD_API_URL + HIGGSFIELD_API_KEY가 설정된 경우에만 REST 위임.
//     엔드포인트를 env로 주입받는 "구성형 어댑터"라 특정 URL을 하드코딩하지 않는다.
//     미설정 시 CONFIG_MISSING(throw 하지 않음).

import {
  provOk,
  provFail,
  type CreativeProvider,
  type CreativeInput,
  type CreativeAssetOut,
  type ProviderResult,
} from "./types";

function cfg(): { url: string; key: string } | null {
  const url = process.env.HIGGSFIELD_API_URL;
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

async function callHiggsfield(
  kind: "image" | "short_video",
  input: CreativeInput,
): Promise<ProviderResult<CreativeAssetOut>> {
  const c = cfg();
  if (!c) {
    return provFail(
      "CONFIG_MISSING",
      "HIGGSFIELD_API_URL/KEY 미설정 — 에이전트 경로(MCP generate_image/generate_video)를 사용하세요",
    );
  }
  const started = Date.now();
  const path = kind === "image" ? "/v1/image" : "/v1/video";
  try {
    const res = await fetch(`${c.url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio ?? "1:1",
        reference_urls: input.brandRefUrls ?? [],
      }),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return provFail("UNAUTHORIZED", "Higgsfield 인증 실패");
    if (res.status === 429) return provFail("RATE_LIMITED", "Higgsfield 호출 한도 초과");
    if (!res.ok) return provFail("UPSTREAM_ERROR", `Higgsfield ${res.status}`);
    const json = (await res.json()) as { url?: string; output_url?: string };
    const url = json.url ?? json.output_url;
    if (!url) return provFail("UPSTREAM_ERROR", "Higgsfield 응답에 산출물 URL 없음");
    return provOk(
      { kind, url, provider: "higgsfield", meta: { prompt: input.prompt } },
      { source: "higgsfield", elapsedMs: Date.now() - started },
    );
  } catch (e) {
    return provFail("UPSTREAM_ERROR", "Higgsfield 요청 실패", e);
  }
}

export const higgsfieldCreative: CreativeProvider = {
  generateImage: (input) => callHiggsfield("image", input),
  generateShortVideo: (input) => callHiggsfield("short_video", input),
  async predictVirality(assetUrl: string): Promise<ProviderResult<{ score: number; notes?: string }>> {
    const c = cfg();
    if (!c) {
      return provFail(
        "CONFIG_MISSING",
        "HIGGSFIELD_API_URL/KEY 미설정 — 에이전트 경로(MCP virality_predictor)를 사용하세요",
      );
    }
    try {
      const res = await fetch(`${c.url}/v1/virality`, {
        method: "POST",
        headers: { Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: assetUrl }),
        cache: "no-store",
      });
      if (!res.ok) return provFail("UPSTREAM_ERROR", `Higgsfield virality ${res.status}`);
      const json = (await res.json()) as { score?: number; notes?: string };
      return provOk({ score: typeof json.score === "number" ? json.score : 0, notes: json.notes }, { source: "higgsfield" });
    } catch (e) {
      return provFail("UPSTREAM_ERROR", "바이럴 예측 실패", e);
    }
  },
};
