// src/server/marketing/providers/claude-content.ts
//
// 외부 seo-generator(SEO_GENERATOR_URL) 미배포 환경을 위한 자체 ContentProvider.
// Claude(claude.ts generateSeoBlogDraft)로 직접 구조화 초안을 만들어 BlogDraft로 매핑한다.
// AI 미설정 시 CONFIG_MISSING(throw 없이) — 파이프라인이 죽지 않게.

import { generateSeoBlogDraft, isAiConfigured, type SeoBlogDraft } from "@/server/ai/claude";
import {
  provOk,
  provFail,
  type ContentProvider,
  type BlogDraft,
  type BlogDraftInput,
  type ProviderResult,
} from "./types";

export const claudeContent: ContentProvider = {
  async draftBlogPost(input: BlogDraftInput): Promise<ProviderResult<BlogDraft>> {
    if (!isAiConfigured()) return provFail("CONFIG_MISSING", "ANTHROPIC_API_KEY 미설정");
    const started = Date.now();
    try {
      const a = await generateSeoBlogDraft({
        keyword: input.keyword,
        audience: input.audience,
        notes: input.notes,
        referenceUrls: input.referenceUrls,
        medical: input.medical,
      });
      const draft: BlogDraft = {
        titleCandidates: a.titleCandidates,
        recommendedTitle: a.recommendedTitle,
        metaDescription: a.metaDescription,
        outline: a.outline,
        bodyMarkdown: a.bodyMarkdown,
        faq: a.faq,
        hashtags: a.hashtags,
        jsonLd: buildJsonLd(a),
      };
      return provOk(draft, { source: "claude", elapsedMs: Date.now() - started });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("AI_NOT_CONFIGURED")) return provFail("CONFIG_MISSING", "ANTHROPIC_API_KEY 미설정", e);
      return provFail("UPSTREAM_ERROR", "Claude 초안 생성 실패", e);
    }
  },
};

// SEO/GEO 구조화 데이터(Article + FAQPage) — 답변엔진 인용 신호.
function buildJsonLd(a: SeoBlogDraft): unknown {
  const graph: unknown[] = [
    {
      "@type": "Article",
      headline: a.recommendedTitle,
      description: a.metaDescription,
      keywords: a.hashtags.map((h) => h.replace(/^#/, "")).join(", "),
    },
  ];
  if (a.faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: a.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
