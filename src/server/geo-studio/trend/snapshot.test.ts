import { describe, expect, it } from "vitest";
import { summarizeHistory } from "./snapshot";

describe("summarizeHistory — 스냅샷 이력(P3b)", () => {
  it("시간순 정렬 + 직전 저장 대비 delta", () => {
    const rows = [
      { capturedAt: new Date("2026-07-01"), latestRatio: 40 },
      { capturedAt: new Date("2026-05-01"), latestRatio: 30 },
      { capturedAt: new Date("2026-06-01"), latestRatio: 55 }
    ];
    const out = summarizeHistory(rows);
    expect(out.map((h) => h.ratio)).toEqual([30, 55, 40]); // 5월,6월,7월
    expect(out[0].deltaVsPrev).toBeNull(); // 첫 저장
    expect(out[1].deltaVsPrev).toBe(25); // 55-30
    expect(out[2].deltaVsPrev).toBe(-15); // 40-55
  });

  it("ratio null이면 delta도 null", () => {
    const out = summarizeHistory([
      { capturedAt: new Date("2026-05-01"), latestRatio: 20 },
      { capturedAt: new Date("2026-06-01"), latestRatio: null }
    ]);
    expect(out[1].deltaVsPrev).toBeNull();
  });

  it("빈 목록은 빈 배열", () => {
    expect(summarizeHistory([])).toEqual([]);
  });
});
