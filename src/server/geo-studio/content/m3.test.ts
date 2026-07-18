// GEO Studio · M3 콘텐츠 빌더 — 규칙 기반 분석 코어 골든 테스트(파이썬 동등성).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { normalize, stripMarkdown, sentences, keywords, topKeywords } from "./textutil";
import { blufScore, ruleRewrite } from "./bluf";
import { auditEeat } from "./eeat";
import { ruleFaq, buildJsonLd, validateJsonLd } from "./faq";
import { faqCoverageScore, structuredDataScore, heuristicCitation, analyzeGeo } from "./analyze";

const g = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/m3.golden.json"), "utf8"));

const BAD = "안녕하세요, 오늘은 아메리카노에 대해 알아보겠습니다. 아메리카노는 에스프레소에 물을 더한 커피입니다. 맛이 좋습니다.";
const GOOD =
  "아메리카노란 에스프레소에 뜨거운 물을 더한 커피입니다. 직접 사용해 보니 원두 종류에 따라 맛이 달라집니다. " +
  "데이터에 따르면 국내 카페 매출의 40%가 아메리카노입니다.\n\n" +
  "## 자주 묻는 질문\nQ: 아메리카노란 무엇인가요?\nA: 에스프레소에 물을 더한 커피입니다.\n\n" +
  '<script type="application/ld+json">{"@type":"FAQPage"}</script>';

describe("M3 · textutil", () => {
  it("normalize", () => expect(normalize("  ㈜베놈   테스트\n\n줄바꿈  ")).toBe(g.normalize));
  it("strip_markdown", () => expect(stripMarkdown("## 제목 **강조** - 항목 `코드`")).toBe(g.strip_markdown));
  it("sentences", () => expect(sentences(GOOD)).toEqual(g.sentences));
  it("keywords", () => expect(keywords("아메리카노는 커피입니다 맛이 좋아요")).toEqual(g.keywords));
  it("top_keywords", () => expect(topKeywords(GOOD, 6)).toEqual(g.top_keywords));
});

describe("M3 · BLUF", () => {
  it("bluf_score bad/good", () => {
    expect(blufScore(BAD, "아메리카노")).toBe(g.bluf_bad);
    expect(blufScore(GOOD, "아메리카노")).toBe(g.bluf_good);
  });
  it("rule_rewrite", () => expect(ruleRewrite(BAD, "아메리카노")).toBe(g.rewrite_bad));
});

describe("M3 · E-E-A-T", () => {
  it("audit_eeat good", () => {
    const r = auditEeat(GOOD);
    expect({
      experience: r.experience,
      expertise: r.expertise,
      authoritativeness: r.authoritativeness,
      trustworthiness: r.trustworthiness,
      total: r.total,
      missing_signals: r.missingSignals,
      suggestions: r.suggestions
    }).toEqual(g.eeat_good);
  });
  it("audit_eeat bad total", () => expect(auditEeat(BAD).total).toBe(g.eeat_bad.total));
});

describe("M3 · FAQ", () => {
  it("rule_faq", () => {
    const items = ruleFaq(GOOD, "아메리카노", 3);
    expect(items.map((i) => ({ question: i.question, answer: i.answer }))).toEqual(g.rule_faq);
  });
  it("build_json_ld = 파이썬 json.dumps(indent=2) 동등", () => {
    const items = ruleFaq(GOOD, "아메리카노", 3);
    expect(buildJsonLd(items)).toBe(g.json_ld);
  });
  it("validate_json_ld", () => {
    const okItems = ruleFaq(GOOD, "아메리카노", 3);
    const okRes = validateJsonLd(buildJsonLd(okItems));
    expect([okRes.valid, okRes.errors]).toEqual(g.validate_ok);
    const badRes = validateJsonLd('{"@type":"Article"}');
    expect([badRes.valid, badRes.errors]).toEqual(g.validate_bad);
  });
});

describe("M3 · GEO 점수", () => {
  it("faq_coverage_score", () => {
    expect(faqCoverageScore(GOOD)).toBe(g.faq_cov_good);
    expect(faqCoverageScore(BAD)).toBe(g.faq_cov_bad);
  });
  it("structured_data_score", () => {
    expect(structuredDataScore(GOOD)).toBe(g.structured_good);
    expect(structuredDataScore(BAD)).toBe(g.structured_bad);
  });
  it("heuristic_citation", () => expect(heuristicCitation(GOOD)).toBe(g.heuristic_good));
  it("analyze_geo (규칙 경로)", () => {
    const s = analyzeGeo(GOOD, "아메리카노");
    expect({
      total: s.total,
      bluf: s.bluf,
      faq_coverage: s.faqCoverage,
      citation_potential: s.citationPotential,
      eeat: s.eeat,
      structured_data: s.structuredData,
      suggestions: s.suggestions
    }).toEqual(g.analyze_good);
  });
});
