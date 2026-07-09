// src/server/marketing/providers/canva.ts
//
// Canva 크리에이티브 provider(카드뉴스/썸네일/브랜드 일관 디자인).
//
// Canva는 본질적으로 "브랜드 템플릿 + 데이터 자동채움 + export"의 대화형 워크플로라
// 에이전트 경로(MCP)가 1순위다:
//   search-brand-templates → generate-design(or create-design-from-brand-template) → export-design
//
// 서버 경로(CANVA_ACCESS_TOKEN, Canva Connect API)는 autofill/export 비동기 폴링이 필요해
// 후속 작업으로 둔다. 토큰 미설정 시 CONFIG_MISSING, 설정 시 NOT_SUPPORTED(후속)로 명확히 신호한다.
// (허구의 REST 흐름을 하드코딩하지 않는다.)

import {
  provFail,
  type CreativeProvider,
  type CreativeInput,
  type CreativeAssetOut,
  type ProviderResult,
} from "./types";

export const canvaCreative: CreativeProvider = {
  async generateImage(_input: CreativeInput): Promise<ProviderResult<CreativeAssetOut>> {
    const token = process.env.CANVA_ACCESS_TOKEN;
    if (!token) {
      return provFail(
        "CONFIG_MISSING",
        "CANVA_ACCESS_TOKEN 미설정 — 에이전트 경로(MCP generate-design/export-design)를 사용하세요",
      );
    }
    return provFail(
      "NOT_SUPPORTED",
      "서버 경로 Canva 자동생성(autofill+export 폴링)은 후속 구현. 현재는 에이전트 경로(MCP) 사용",
    );
  },
};
