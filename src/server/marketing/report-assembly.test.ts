// src/server/marketing/report-assembly.test.ts
import { describe, it, expect } from "vitest";
import { summarizeRanks } from "./report-assembly";

describe("월간 리포트 집계 summarizeRanks", () => {
  it("평균순위·상위키워드를 계산한다", () => {
    const s = summarizeRanks([
      { keyword: "강남 임플란트", rank: 2 },
      { keyword: "임플란트 가격", rank: 8 },
      { keyword: "미검출 키워드", rank: null },
    ]);
    expect(s.totalKeywords).toBe(3);
    expect(s.rankedCount).toBe(2);
    expect(s.avgRank).toBe(5); // (2+8)/2
    expect(s.top[0].keyword).toBe("강남 임플란트");
    expect(s.summaryText).toContain("2개가 노출권");
  });

  it("전월 대비 순위 상승만 improved에 담는다", () => {
    const now = [
      { keyword: "A", rank: 3 }, // 5→3 상승
      { keyword: "B", rank: 10 }, // 7→10 하락(제외)
      { keyword: "C", rank: 1 }, // 전월 없음(제외)
    ];
    const prev = [
      { keyword: "A", rank: 5 },
      { keyword: "B", rank: 7 },
    ];
    const s = summarizeRanks(now, prev);
    expect(s.improved).toEqual([{ keyword: "A", from: 5, to: 3 }]);
    expect(s.summaryText).toContain("전월 대비 상승");
  });

  it("순위 데이터가 없으면 안전한 문구", () => {
    const s = summarizeRanks([]);
    expect(s.avgRank).toBeNull();
    expect(s.summaryText).toContain("집계되지 않았습니다");
  });
});
