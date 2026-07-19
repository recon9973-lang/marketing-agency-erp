import { describe, expect, it } from "vitest";
import { grade, opportunityScore, strategyDirections } from "./opportunity";

describe("opportunity · grade", () => {
  it("구간별 등급", () => {
    expect(grade(70)).toBe("매우 높음");
    expect(grade(60)).toBe("매우 높음");
    expect(grade(40)).toBe("높음");
    expect(grade(20)).toBe("보통");
    expect(grade(5)).toBe("낮음");
  });
});

describe("opportunity · opportunityScore", () => {
  it("언급률·인용률·콘텐츠 준비도 가중합", () => {
    const s = opportunityScore({ mentionRate: 80, citationRate: 40, publishedPages: 3, hasContent: true });
    // readiness = min(100, 60+20)=80 → 80*.5 + 40*.3 + 80*.2 = 40+12+16 = 68
    expect(s.totalScore).toBe(68);
    expect(s.mentionGrade).toBe("매우 높음");
    expect(s.absorbGrade).toBe("매우 높음");
  });
  it("데이터 없으면 낮음·저점", () => {
    const s = opportunityScore({ mentionRate: 0, citationRate: 0, publishedPages: 0, hasContent: false });
    expect(s.totalScore).toBe(0);
    expect(s.mentionGrade).toBe("낮음");
    expect(s.absorbGrade).toBe("낮음");
  });
});

describe("opportunity · strategyDirections(규칙 기반)", () => {
  it("관측 전이면 측정 먼저", () => {
    const d = strategyDirections({ mentionRate: 0, citationRate: 0, monitoredCount: 0, hasContent: false, publishedPages: 0, weakEngines: [], competitorAhead: null });
    expect(d).toHaveLength(1);
    expect(d[0]).toContain("측정 먼저");
  });
  it("게시 없음·콘텐츠 없음 → 후보진입·답변콘텐츠 제안", () => {
    const d = strategyDirections({ mentionRate: 10, citationRate: 0, monitoredCount: 5, hasContent: false, publishedPages: 0, weakEngines: [], competitorAhead: null });
    expect(d.some((x) => x.includes("검색 후보 진입"))).toBe(true);
    expect(d.some((x) => x.includes("답변형 콘텐츠"))).toBe(true);
  });
  it("언급되나 인용 부족 → 인용 증거 강화", () => {
    const d = strategyDirections({ mentionRate: 60, citationRate: 10, monitoredCount: 5, hasContent: true, publishedPages: 2, weakEngines: [], competitorAhead: null });
    expect(d.some((x) => x.includes("인용 증거 강화"))).toBe(true);
  });
  it("엔진 갭·경쟁 갭 반영, 최대 5개", () => {
    const d = strategyDirections({ mentionRate: 30, citationRate: 5, monitoredCount: 5, hasContent: false, publishedPages: 0, weakEngines: ["PERPLEXITY", "GEMINI"], competitorAhead: "수성정형" });
    expect(d.some((x) => x.includes("Perplexity"))).toBe(true);
    expect(d.some((x) => x.includes("수성정형"))).toBe(true);
    expect(d.length).toBeLessThanOrEqual(5);
  });
  it("완비 상태면 우위 유지·외부 신뢰 제안", () => {
    const d = strategyDirections({ mentionRate: 90, citationRate: 80, monitoredCount: 5, hasContent: true, publishedPages: 5, weakEngines: [], competitorAhead: null });
    expect(d.some((x) => x.includes("우위 유지"))).toBe(true);
  });
});
