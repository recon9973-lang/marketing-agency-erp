// src/server/geo-engine/llms-txt.test.ts
import { describe, it, expect } from "vitest";
import { buildLlmsTxt, isPublishableUrl, llmsInputFromClient } from "./llms-txt";

describe("llms.txt 생성기(순수)", () => {
  it("H1 제목 · 인용 요약 · H2 섹션 · 링크 목록을 규격대로 생성한다", () => {
    const txt = buildLlmsTxt({
      siteTitle: "OO정형외과",
      summary: "무릎·어깨 진료 안내",
      sections: [
        { heading: "핵심 질문 답변", links: [{ title: "도수치료란?", url: "https://oo.kr/manual", note: "비수술 치료" }] }
      ]
    });
    expect(txt).toContain("# OO정형외과");
    expect(txt).toContain("> 무릎·어깨 진료 안내");
    expect(txt).toContain("## 핵심 질문 답변");
    expect(txt).toContain("- [도수치료란?](https://oo.kr/manual): 비수술 치료");
    expect(txt.endsWith("\n")).toBe(true);
  });

  it("절대 http(s) URL만 통과시킨다", () => {
    expect(isPublishableUrl("https://a.kr/x")).toBe(true);
    expect(isPublishableUrl("/relative")).toBe(false);
    expect(isPublishableUrl("javascript:alert(1)")).toBe(false);
  });

  it("깨진/상대 URL 링크는 섹션에서 제외하고, 빈 섹션은 생략한다", () => {
    const txt = buildLlmsTxt({
      siteTitle: "T",
      sections: [
        { heading: "빈섹션", links: [{ title: "x", url: "/nope" }] },
        { heading: "유효", links: [{ title: "ok", url: "https://t.kr/ok" }] }
      ]
    });
    expect(txt).not.toContain("## 빈섹션");
    expect(txt).toContain("## 유효");
  });

  it("게시된 답변 페이지만 모으고 GEO 접두어를 제거한다", () => {
    const input = llmsInputFromClient({
      hospitalName: "베놈한의원",
      department: "한방재활",
      region: "서울 강남구",
      publishedPages: [
        { topic: "[GEO 답변] 추나요법이란?", publishedUrl: "https://v.kr/chuna" },
        { topic: "미게시", publishedUrl: "/draft-only" }
      ]
    });
    const txt = buildLlmsTxt(input);
    expect(txt).toContain("# 베놈한의원");
    expect(txt).toContain("[추나요법이란?](https://v.kr/chuna)");
    expect(txt).not.toContain("draft-only");
  });
});
