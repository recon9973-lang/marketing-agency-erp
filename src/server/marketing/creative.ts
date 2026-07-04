// src/server/marketing/creative.ts
//
// S4 · 크리에이티브 스튜디오 오케스트레이션.
// 키워드/콘텐츠에서 크리에이티브 브리프를 만들고, kind별로 provider에 라우팅한다.
//   image       → Higgsfield generate_image
//   short_video → Higgsfield generate_video / shorts_studio (릴스는 reels-creator 스킬 워크플로와 연동)
//   card_news   → Canva 브랜드 템플릿
//
// reels-creator 스킬: 숏폼/릴스는 "기획→카피→디자인→편집" 전체 워크플로를 그 스킬이 담당하고,
// 이 서비스는 그 결과 영상 자산 생성을 provider로 실행한다(스킬과 도구의 역할 분리).
//
// CreativeAsset 모델은 아직 미마이그레이션 → 결과를 구조화 반환(호출부/UI가 저장).

import { higgsfieldCreative } from "./providers/higgsfield";
import { canvaCreative } from "./providers/canva";
import type { CreativeInput, CreativeAssetOut, ProviderResult } from "./providers/types";

export type CreativeKind = "image" | "short_video" | "card_news";

export type CreativeBrief = CreativeInput & { kind: CreativeKind };

/** 키워드/앵글 → 생성 프롬프트를 담은 브리프. 브랜드 자산(design-resources-repository)을 참조로 주입 가능. */
export function buildCreativeBrief(input: {
  keyword: string;
  angle?: string;
  kind: CreativeKind;
  aspectRatio?: CreativeInput["aspectRatio"];
  brandRefUrls?: string[];
}): CreativeBrief {
  const angle = input.angle ? ` — ${input.angle}` : "";
  const kindHint =
    input.kind === "card_news"
      ? "카드뉴스 슬라이드용 심플하고 가독성 높은 비주얼"
      : input.kind === "short_video"
        ? "숏폼 훅이 강한 세로형 영상 컷"
        : "SNS 피드용 시선을 끄는 이미지";
  return {
    kind: input.kind,
    prompt: `${input.keyword}${angle}. ${kindHint}. 한국어 SNS 마케팅용, 브랜드 톤 일관.`,
    aspectRatio: input.aspectRatio ?? (input.kind === "short_video" ? "9:16" : "1:1"),
    brandRefUrls: input.brandRefUrls ?? [],
  };
}

/** 브리프를 kind에 맞는 provider로 생성 실행. */
export async function generateCreative(brief: CreativeBrief): Promise<ProviderResult<CreativeAssetOut>> {
  switch (brief.kind) {
    case "image":
      return higgsfieldCreative.generateImage(brief);
    case "short_video":
      if (!higgsfieldCreative.generateShortVideo) {
        return higgsfieldCreative.generateImage(brief);
      }
      return higgsfieldCreative.generateShortVideo(brief);
    case "card_news":
      return canvaCreative.generateImage(brief);
  }
}

/** 여러 kind를 한 번에 생성(피드 이미지 + 카드뉴스 등). 실패는 개별 결과로 반환(전체 중단 없음). */
export async function generateCreativeSet(
  briefs: CreativeBrief[],
): Promise<{ kind: CreativeKind; result: ProviderResult<CreativeAssetOut> }[]> {
  const out: { kind: CreativeKind; result: ProviderResult<CreativeAssetOut> }[] = [];
  for (const b of briefs) {
    out.push({ kind: b.kind, result: await generateCreative(b) });
  }
  return out;
}
