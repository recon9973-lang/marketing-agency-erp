// src/domain/content/magazine.test.ts
import { describe, it, expect } from "vitest";
import { parseMagazineTerms, isMagazineCategory, isMagazineKind, buildMagazineMarkdown } from "./magazine";

describe("매거진 용어 파서(순수)", () => {
  it("번호·굵게·대시 형식(용어사전 100 형식)을 파싱한다", () => {
    const raw = "1. **GEO(생성형 엔진 최적화)** — 생성형 AI 답변에 인용되게 만드는 최적화.";
    const [t] = parseMagazineTerms(raw);
    expect(t.title).toBe("GEO(생성형 엔진 최적화)");
    expect(t.seed).toBe("생성형 AI 답변에 인용되게 만드는 최적화.");
  });

  it(":: 구분자와 마커 없는 줄을 처리한다", () => {
    const rows = parseMagazineTerms("SEO :: 검색 최적화\n- 그냥 용어");
    expect(rows[0]).toEqual({ title: "SEO", seed: "검색 최적화" });
    expect(rows[1]).toEqual({ title: "그냥 용어", seed: null });
  });

  it("헤더·빈 줄·짧은 줄을 건너뛴다", () => {
    const rows = parseMagazineTerms("## 카테고리\n\n> 인용\nA\n유효한용어");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("유효한용어");
  });

  it("제목 기준 중복을 제거한다", () => {
    const rows = parseMagazineTerms("GEO — 정의1\ngeo — 정의2");
    expect(rows).toHaveLength(1);
  });

  it("카테고리·유형 가드", () => {
    expect(isMagazineCategory("SEO")).toBe(true);
    expect(isMagazineCategory("없음")).toBe(false);
    expect(isMagazineKind("glossary")).toBe(true);
    expect(isMagazineKind("x")).toBe(false);
  });

  it("마크다운이 BLUF 구조(제목 직후 핵심 요약)를 지킨다", () => {
    const md = buildMagazineMarkdown({
      title: "AEO란?",
      summary: "답변 엔진 최적화입니다.",
      sections: [{ heading: "정의", body: "본문." }],
      related: ["SEO", "GEO"],
      faq: [{ q: "차이는?", a: "대상이 다릅니다." }]
    });
    const lines = md.split("\n").filter(Boolean);
    expect(lines[0]).toBe("# AEO란?");
    expect(lines[1]).toBe("답변 엔진 최적화입니다.");
    expect(md).toContain("## 정의");
    expect(md).toContain("## 자주 묻는 질문");
    expect(md).toContain("**관련 용어:** SEO · GEO");
  });
});
