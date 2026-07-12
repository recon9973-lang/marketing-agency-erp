import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutableEnv = process.env as Record<string, string | undefined>;

const generateSeoBlogDraftMock = vi.fn();
const isAiConfiguredMock = vi.fn(() => true);

vi.mock("@/server/ai/claude", () => ({
  generateSeoBlogDraft: generateSeoBlogDraftMock,
  isAiConfigured: isAiConfiguredMock,
}));

const cleanDraft = {
  titleCandidates: ["강남 임플란트 완전정복", "임플란트 A~Z"],
  recommendedTitle: "강남 임플란트 완전정복",
  metaDescription: "임플란트 과정과 준비를 정리했습니다.".repeat(6),
  outline: ["개요", "과정", "주의", "FAQ"],
  bodyMarkdown: "## 개요\n임플란트는 치아를 대체하는 방법입니다.",
  faq: [{ q: "얼마나 걸리나요?", a: "개인차가 있으며 전문의 상담이 필요합니다." }],
  hashtags: ["#임플란트", "#치과"],
};

describe("runBlogDraftPipeline — Claude 폴백(SEO_GENERATOR_URL 미설정)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isAiConfiguredMock.mockReturnValue(true);
    delete mutableEnv.SEO_GENERATOR_URL; // 폴백 경로 강제
  });
  afterEach(() => {
    delete mutableEnv.SEO_GENERATOR_URL;
  });

  it("SEO_GENERATOR_URL 미설정이면 Claude 제공자를 고른다", async () => {
    const { resolveContentProvider } = await import("@/server/marketing/providers/content-provider");
    const { claudeContent } = await import("@/server/marketing/providers/claude-content");
    expect(resolveContentProvider()).toBe(claudeContent);
  });

  it("SEO_GENERATOR_URL 설정이면 seo-generator 제공자를 고른다", async () => {
    mutableEnv.SEO_GENERATOR_URL = "https://seo-generator.example.com";
    const { resolveContentProvider } = await import("@/server/marketing/providers/content-provider");
    const { seoGeneratorContent } = await import("@/server/marketing/providers/seo-content");
    expect(resolveContentProvider()).toBe(seoGeneratorContent);
  });

  it("비의료 주제는 Claude 초안으로 READY가 된다", async () => {
    generateSeoBlogDraftMock.mockResolvedValue(cleanDraft);
    const { runBlogDraftPipeline } = await import("@/server/marketing/content-pipeline");
    const res = await runBlogDraftPipeline({
      clientId: "c1",
      keyword: "강남 임플란트",
      referenceUrls: [],
      medical: false,
    });
    expect(generateSeoBlogDraftMock).toHaveBeenCalledOnce();
    expect(res.ok).toBe(true);
    expect(res.stage).toBe("READY");
    expect(res.draft?.recommendedTitle).toBe("강남 임플란트 완전정복");
    // FAQ/JSON-LD(AEO 신호)가 채워졌는지
    expect(res.draft?.faq.length).toBeGreaterThan(0);
    expect(res.draft?.jsonLd).toBeTruthy();
  });

  it("의료 주제에서 보장·단정 표현이 있으면 컴플라이언스 게이트가 막는다", async () => {
    generateSeoBlogDraftMock.mockResolvedValue({
      ...cleanDraft,
      bodyMarkdown: "## 효과\n임플란트는 100% 완치를 보장합니다. 무조건 성공합니다.",
    });
    const { runBlogDraftPipeline } = await import("@/server/marketing/content-pipeline");
    const res = await runBlogDraftPipeline({
      clientId: "c1",
      keyword: "임플란트",
      referenceUrls: [],
      medical: true,
    });
    expect(res.stage).toBe("COMPLIANCE_REVIEW");
    expect(res.ok).toBe(false);
  });

  it("AI 미설정이면 초안 실패로 파이프라인이 FAILED가 된다", async () => {
    isAiConfiguredMock.mockReturnValue(false);
    const { runBlogDraftPipeline } = await import("@/server/marketing/content-pipeline");
    const res = await runBlogDraftPipeline({
      clientId: "c1",
      keyword: "임플란트",
      referenceUrls: [],
      medical: false,
    });
    expect(res.ok).toBe(false);
    expect(res.stage).toBe("FAILED");
    expect(res.error).toBe("CONFIG_MISSING");
  });
});
