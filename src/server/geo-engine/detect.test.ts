// src/server/geo-engine/detect.test.ts
import { describe, it, expect } from "vitest";
import { detectAnswer, extractDomain } from "./detect";

describe("GEO 자동 관측 — 답변 판정", () => {
  const target = { hospitalName: "튼튼마디한의원", siteDomain: "sc-domain:ttjoint.co.kr", competitors: ["OO한의원", "바른몸한의원"] };

  it("병원명 언급을 출현으로 판정한다(공백 변형 포함)", () => {
    const r = detectAnswer("마산에서는 튼튼마디 한의원이 도수치료로 알려져 있습니다.", [], target);
    expect(r.appeared).toBe(true);
    expect(r.cited).toBe(false);
  });

  it("공식 도메인 인용을 cited로 판정하고 출현으로도 간주한다", () => {
    const r = detectAnswer("관련 정보는 공식 사이트를 참고하세요.", ["https://www.ttjoint.co.kr/faq"], target);
    expect(r.cited).toBe(true);
    expect(r.appeared).toBe(true);
  });

  it("경쟁사 언급을 수집한다", () => {
    const r = detectAnswer("바른몸한의원과 비교하면...", [], target);
    expect(r.competitorsMentioned).toEqual(["바른몸한의원"]);
    expect(r.appeared).toBe(false);
  });

  it("무관한 답변은 모두 false", () => {
    const r = detectAnswer("한의원 선택 시 의료진 경력과 후기를 확인하세요.", ["https://blog.naver.com/xyz"], target);
    expect(r.appeared).toBe(false);
    expect(r.cited).toBe(false);
    expect(r.competitorsMentioned).toEqual([]);
  });

  it("[데모] 접두는 병원명 매칭에서 무시한다", () => {
    const r = detectAnswer("튼튼마디한의원 추천", [], { hospitalName: "[데모] 튼튼마디한의원" });
    expect(r.appeared).toBe(true);
  });
});

describe("도메인 추출", () => {
  it("sc-domain·URL·www 변형을 정규화한다", () => {
    expect(extractDomain("sc-domain:foo.co.kr")).toBe("foo.co.kr");
    expect(extractDomain("https://www.foo.co.kr/path?q=1")).toBe("foo.co.kr");
    expect(extractDomain("foo.co.kr")).toBe("foo.co.kr");
    expect(extractDomain(null)).toBeNull();
  });
});
