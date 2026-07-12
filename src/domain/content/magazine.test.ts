// src/domain/content/magazine.test.ts
import { describe, it, expect } from "vitest";
import { parseMagazineTerms, isMagazineCategory, isMagazineKind, buildMagazineMarkdown, buildInstagramCaption, extractMagazineSummary } from "./magazine";

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

describe("인스타그램 캡션(순수)", () => {
  it("마크다운에서 BLUF 요약을 뽑고 강조/헤딩을 건너뛴다", () => {
    const md = "# 제목\n\n**AEO**는 답변 엔진 최적화입니다.\n\n## 섹션\n본문";
    expect(extractMagazineSummary(md)).toBe("AEO는 답변 엔진 최적화입니다.");
  });

  it("긴 요약은 단어 경계에서 말줄임한다", () => {
    const long = "# t\n\n" + "가나다라마 ".repeat(60);
    const s = extractMagazineSummary(long, 40);
    expect(s.length).toBeLessThanOrEqual(41);
    expect(s.endsWith("…")).toBe(true);
  });

  it("캡션은 제목·요약·프로필유도·해시태그를 포함하고 해시태그를 중복 없이 30개 이하로 유지한다", () => {
    const cap = buildInstagramCaption({
      title: "AEO란 무엇인가",
      category: "AEO/GEO",
      kind: "glossary",
      draft: "# AEO란 무엇인가\n\n답변 엔진 최적화입니다.\n\n## 정의\n본문"
    });
    expect(cap.startsWith("AEO란 무엇인가")).toBe(true);
    expect(cap).toContain("답변 엔진 최적화입니다.");
    expect(cap).toContain("프로필 링크");
    expect(cap).toContain("#GROUND");
    expect(cap).toContain("#GEO");
    expect(cap).toContain("#용어사전");
    const tags = cap.split(/\s+/).filter((t) => t.startsWith("#"));
    expect(tags.length).toBeLessThanOrEqual(30);
    expect(new Set(tags).size).toBe(tags.length); // 중복 없음
  });

  it("초안이 없으면 요약 없이도 캡션을 만든다", () => {
    const cap = buildInstagramCaption({ title: "제목만", category: "SEO", kind: "howto", draft: null });
    expect(cap.startsWith("제목만")).toBe(true);
    expect(cap).toContain("#SEO");
    expect(cap).toContain("#사용법");
  });
});
