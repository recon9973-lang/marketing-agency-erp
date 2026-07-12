// src/server/marketing/render-plan.test.ts
import { describe, it, expect } from "vitest";
import { markdownToHtml, planTitle, renderContentPlanForPublish } from "./render-plan";

describe("발행 렌더러(순수)", () => {
  it("GEO 접두어를 제거해 자연스러운 제목을 만든다", () => {
    expect(planTitle({ topic: "[GEO 답변] 도수치료란?", angle: null, faq: [], qa: [], draft: null })).toBe("도수치료란?");
    expect(planTitle({ topic: "여름철 피부관리", angle: null, faq: [], qa: [], draft: null })).toBe("여름철 피부관리");
  });

  it("마크다운 제목·인용·굵게를 HTML로 변환한다", () => {
    const html = markdownToHtml("# 제목\n\n핵심 **답변**입니다.\n\n> 주의 문구");
    expect(html).toContain("<h1>제목</h1>");
    expect(html).toContain("<strong>답변</strong>");
    expect(html).toContain("<blockquote>주의 문구</blockquote>");
  });

  it("JSON-LD 코드펜스를 script 태그로 승격한다", () => {
    const md = '## FAQ\n\n```json\n{"@type":"FAQPage"}\n```';
    const html = markdownToHtml(md);
    expect(html).toContain('<script type="application/ld+json">{"@type":"FAQPage"}</script>');
    expect(html).not.toContain("```");
  });

  it("깨진 JSON-LD 펜스는 게시 본문에서 제외한다", () => {
    const html = markdownToHtml("```json\n{oops not json\n```");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("oops");
  });

  it("HTML 태그 주입을 이스케이프한다", () => {
    const html = markdownToHtml("본문 <script>alert(1)</script> 끝");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("draft가 없으면 angle·Q&A로 조립한다", () => {
    const { title, html } = renderContentPlanForPublish({
      topic: "무릎 통증",
      angle: "무릎 통증의 원인은 다양합니다.",
      faq: [],
      qa: [{ q: "치료 기간은?", a: "상태에 따라 다릅니다." }],
      draft: null
    });
    expect(title).toBe("무릎 통증");
    expect(html).toContain("무릎 통증의 원인");
    expect(html).toContain("<h3>치료 기간은?</h3>");
    expect(html).toContain("상태에 따라 다릅니다.");
  });
});
