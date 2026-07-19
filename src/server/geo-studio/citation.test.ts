import { describe, expect, it } from "vitest";
import { aggregateRun, dailyMentionSeries, majorityAppeared, type DatedCell, type EngineObservation } from "./citation";

describe("citation · majorityAppeared(반복 다수결)", () => {
  it("과반 등장이면 true, 동수/미달이면 false(보수적)", () => {
    expect(majorityAppeared([true, true, false])).toBe(true); // 2/3
    expect(majorityAppeared([true, false, false])).toBe(false); // 1/3
    expect(majorityAppeared([true, false])).toBe(false); // 동수 → false
    expect(majorityAppeared([true, true])).toBe(true);
    expect(majorityAppeared([])).toBe(false);
    expect(majorityAppeared([true])).toBe(true);
  });
});

describe("citation · aggregateRun(실행 집계)", () => {
  const obs: EngineObservation[] = [
    { engine: "CHATGPT", appeared: true, cited: true, rank: 1 },
    { engine: "GEMINI", appeared: true, cited: false, rank: 3 },
    { engine: "CLAUDE", appeared: false, cited: false, rank: null },
    { engine: "PERPLEXITY", appeared: true, cited: false, rank: 2 }
  ];
  it("언급률·인용수·평균순위 집계", () => {
    const a = aggregateRun(obs);
    expect(a.totalModels).toBe(4);
    expect(a.mentionedModels).toBe(3);
    expect(a.mentionRate).toBeCloseTo(0.75);
    expect(a.citedModels).toBe(1);
    expect(a.avgRank).toBe(2); // (1+3+2)/3
    expect(a.byEngine.CHATGPT).toEqual({ mentioned: true, cited: true, rank: 1 });
  });
  it("엔진 중복은 첫 값만, 언급 0이면 avgRank null·rate 0", () => {
    const a = aggregateRun([
      { engine: "CHATGPT", appeared: false, cited: false, rank: null },
      { engine: "CHATGPT", appeared: true, cited: false, rank: 1 } // 무시
    ]);
    expect(a.totalModels).toBe(1);
    expect(a.mentionedModels).toBe(0);
    expect(a.mentionRate).toBe(0);
    expect(a.avgRank).toBeNull();
  });
  it("빈 입력은 0/0, rate 0", () => {
    const a = aggregateRun([]);
    expect(a.totalModels).toBe(0);
    expect(a.mentionRate).toBe(0);
    expect(a.avgRank).toBeNull();
  });
});

describe("citation · dailyMentionSeries(일별 시계열)", () => {
  const cells: DatedCell[] = [
    { checkedOn: "2026-06-01", engine: "CHATGPT", appeared: false },
    { checkedOn: "2026-06-01", engine: "GEMINI", appeared: false },
    { checkedOn: "2026-06-08", engine: "CHATGPT", appeared: true },
    { checkedOn: "2026-06-08", engine: "GEMINI", appeared: false },
    { checkedOn: "2026-06-15", engine: "CHATGPT", appeared: true },
    { checkedOn: "2026-06-15", engine: "GEMINI", appeared: true }
  ];
  it("날짜별 언급 비율(%) 오름차순", () => {
    const s = dailyMentionSeries(cells);
    expect(s.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-08", "2026-06-15"]);
    expect(s.map((p) => p.rate)).toEqual([0, 50, 100]);
    expect(s[2]).toMatchObject({ total: 2, mentioned: 2 });
  });
  it("입력 순서 무관, 빈 입력은 빈 배열", () => {
    expect(dailyMentionSeries([])).toEqual([]);
    const s = dailyMentionSeries([...cells].reverse());
    expect(s.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-08", "2026-06-15"]);
  });
});
