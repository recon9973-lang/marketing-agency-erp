// src/domain/sales/geo.test.ts
import { describe, it, expect } from "vitest";
import { buildGeoQuestionCandidates, isGeoEngine, GEO_ENGINES } from "./geo";

describe("GEO 질문 후보 생성 (기획서 §5-7 질문 20개 + 업무매뉴얼 05 SOP)", () => {
  it("정확히 20개를 생성하고 진료과·지역을 치환한다", () => {
    const candidates = buildGeoQuestionCandidates("피부과", "강남");
    expect(candidates).toHaveLength(20);
    expect(candidates.every((c) => !c.question.includes("{department}") && !c.question.includes("{region}"))).toBe(true);
    expect(candidates.some((c) => c.question.includes("강남") && c.question.includes("피부과"))).toBe(true);
  });

  it("SOP 5유형(정의·판단·비교·위험·지역)을 각 4개씩 커버한다", () => {
    const candidates = buildGeoQuestionCandidates("정형외과", "분당");
    const byType = new Map<string, number>();
    for (const c of candidates) byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
    expect([...byType.keys()].sort()).toEqual(["비교형", "위험형", "정의형", "지역형", "판단형"]);
    expect([...byType.values()].every((n) => n === 4)).toBe(true);
  });

  it("지역형은 높은 우선순위(1~2)", () => {
    const candidates = buildGeoQuestionCandidates("치과", "서초");
    const local = candidates.filter((c) => c.type === "지역형");
    expect(local.every((c) => c.priority <= 2)).toBe(true);
    expect(local.every((c) => c.question.includes("서초"))).toBe(true);
  });

  it("빈 입력은 기본값으로 대체한다", () => {
    const candidates = buildGeoQuestionCandidates("", "");
    expect(candidates.every((c) => c.question.includes("병원") || c.question.includes("우리 지역"))).toBe(true);
  });
});

describe("GEO 엔진", () => {
  it("4대 엔진(ChatGPT·Gemini·Claude·Perplexity)+국내 2종을 정의하고 가드가 동작한다", () => {
    expect(GEO_ENGINES).toHaveLength(6);
    expect(isGeoEngine("CHATGPT")).toBe(true);
    expect(isGeoEngine("CLAUDE")).toBe(true);
    expect(isGeoEngine("BING")).toBe(false);
  });
});
