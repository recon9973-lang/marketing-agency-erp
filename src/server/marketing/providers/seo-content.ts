// src/server/marketing/providers/seo-content.ts
//
// seo-generator(recon9973-lang/seo-generator) 웹앱의 /api/generate를 재사용하는
// ContentProvider 어댑터. 생성 로직을 이 레포에 중복하지 않고 HTTP로 위임한다
// (단일 진실원). 응답 규격(article)을 VME의 BlogDraft로 매핑한다.
//
// 환경변수: SEO_GENERATOR_URL = 배포된 seo-generator 베이스 URL (예: https://seo-generator.vercel.app)
// 미설정 시 CONFIG_MISSING 반환(throw 하지 않음).

import {
  provOk,
  provFail,
  type ContentProvider,
  type BlogDraft,
  type BlogDraftInput,
  type ProviderResult,
} from "./types";

// seo-generator /api/generate 응답의 article 형태(api/generate.js buildArticle 기준).
type SeoGeneratorArticle = {
  keyword: string;
  titleCandidates: string[];
  recommendedTitle: string;
  description: string;
  tableOfContents: string[];
  sections: { heading: string; body: string }[];
  faq: { question: string; answer: string }[];
  hashtags: string[];
};

const MEDICAL_GUIDANCE =
  "※ 의료·건강 주제: 의료광고법을 준수하세요. 치료효과 단정·보장, 최상급/유일성, 비급여 할인·이벤트 유인, 타 병원 비교 표현을 쓰지 마세요. 효과를 언급하면 부작용·주의·개인차를 함께 적고, 진단·치료는 의료진 상담이 필요함을 남기세요.";

export const seoGeneratorContent: ContentProvider = {
  async draftBlogPost(input: BlogDraftInput): Promise<ProviderResult<BlogDraft>> {
    const base = process.env.SEO_GENERATOR_URL;
    if (!base) return provFail("CONFIG_MISSING", "SEO_GENERATOR_URL 미설정");

    const started = Date.now();
    const sourceText = [input.notes ?? "", input.medical ? MEDICAL_GUIDANCE : ""].filter(Boolean).join("\n");
    const tone = input.audience ? `${input.audience}을(를) 위한, 친절하고 전문적인` : "친절하고 전문적인";

    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: input.keyword,
          sourceUrls: input.referenceUrls ?? [],
          sourceText,
          tone,
        }),
        cache: "no-store",
      });
      if (res.status === 400) return provFail("CONFIG_MISSING", "seo-generator OPENAI_API_KEY 미설정 가능성");
      if (!res.ok) return provFail("UPSTREAM_ERROR", `seo-generator ${res.status}`);

      const json = (await res.json()) as { article?: SeoGeneratorArticle };
      const a = json.article;
      if (!a) return provFail("UPSTREAM_ERROR", "seo-generator 응답에 article 없음");

      const draft: BlogDraft = {
        titleCandidates: a.titleCandidates ?? [],
        recommendedTitle: a.recommendedTitle ?? a.titleCandidates?.[0] ?? "",
        metaDescription: a.description ?? "",
        outline: a.tableOfContents ?? [],
        bodyMarkdown: sectionsToMarkdown(a),
        faq: (a.faq ?? []).map((f) => ({ q: f.question, a: f.answer })),
        hashtags: a.hashtags ?? [],
        jsonLd: buildJsonLd(a),
      };
      return provOk(draft, { source: "seo-generator", elapsedMs: Date.now() - started });
    } catch (e) {
      return provFail("UPSTREAM_ERROR", "seo-generator 요청 실패", e);
    }
  },
};

function sectionsToMarkdown(a: SeoGeneratorArticle): string {
  const parts: string[] = [`# ${a.recommendedTitle}`, "", a.description ?? "", ""];
  for (const s of a.sections ?? []) {
    parts.push(`## ${s.heading}`, "", s.body ?? "", "");
  }
  if ((a.faq ?? []).length) {
    parts.push("## 자주 묻는 질문(FAQ)", "");
    for (const f of a.faq) parts.push(`**Q. ${f.question}**`, "", f.answer ?? "", "");
  }
  if ((a.hashtags ?? []).length) parts.push("", a.hashtags.join(" "));
  return parts.join("\n").trim();
}

// SEO/GEO를 위한 구조화 데이터(Article + FAQPage).
function buildJsonLd(a: SeoGeneratorArticle): unknown {
  const graph: unknown[] = [
    {
      "@type": "Article",
      headline: a.recommendedTitle,
      description: a.description,
      articleBody: (a.sections ?? []).map((s) => s.body).join("\n\n"),
      keywords: (a.hashtags ?? []).map((h) => h.replace(/^#/, "")).join(", "),
    },
  ];
  if ((a.faq ?? []).length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: a.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
