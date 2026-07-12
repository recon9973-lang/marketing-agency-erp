// src/server/marketing/providers/content-provider.ts
//
// 블로그 초안 ContentProvider 선택기.
// - SEO_GENERATOR_URL이 설정되어 있으면 외부 seo-generator(단일 진실원)를 우선 사용.
// - 미설정이면 Claude 자체 생성(claudeContent)으로 폴백 → 외부 앱 없이도 스튜디오가 동작.

import { seoGeneratorContent } from "./seo-content";
import { claudeContent } from "./claude-content";
import type { ContentProvider } from "./types";

export function resolveContentProvider(): ContentProvider {
  return process.env.SEO_GENERATOR_URL ? seoGeneratorContent : claudeContent;
}
