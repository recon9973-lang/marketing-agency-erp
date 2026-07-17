// src/server/marketing/week-window.test.ts
// 로컬 시간 기준(time.ts weekStart와 동일)이라, 테스트는 로컬 Date 생성자·로컬 getter로 TZ 독립 검증.
import { describe, it, expect } from "vitest";
import { currentWeekWindow } from "./week-window";

describe("currentWeekWindow(월요일 기준 주간 창)", () => {
  it("어떤 요일 입력이든 start는 월요일 00:00, end는 7일 뒤", () => {
    // 2026-07-13(월)~19(일) 주간의 여러 로컬 시각
    for (const d of [
      new Date(2026, 6, 13, 9),
      new Date(2026, 6, 16, 23, 59),
      new Date(2026, 6, 19, 12),
      new Date(2026, 0, 1, 15)
    ]) {
      const w = currentWeekWindow(d);
      expect(w.start.getDay()).toBe(1); // 월요일
      expect(w.start.getHours()).toBe(0);
      expect(Math.round((w.end.getTime() - w.start.getTime()) / 86400000)).toBe(7);
    }
  });

  it("입력 시각은 항상 [start, end) 창 내부에 있다", () => {
    const now = new Date(2026, 6, 16, 23, 59);
    const w = currentWeekWindow(now);
    expect(w.start.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(now.getTime()).toBeLessThan(w.end.getTime());
  });

  it("일요일 입력은 그 주 월요일로 정렬된다", () => {
    const w = currentWeekWindow(new Date(2026, 6, 19, 10)); // 일요일
    expect(w.weekLabel.startsWith("2026-07-13")).toBe(true);
  });

  it("월요일 입력은 당일이 start가 된다", () => {
    const w = currentWeekWindow(new Date(2026, 6, 13, 10));
    expect(w.weekLabel.startsWith("2026-07-13")).toBe(true);
  });

  it("weekLabel은 'start ~ lastDay'(6일 뒤) 형식이다", () => {
    const w = currentWeekWindow(new Date(2026, 6, 15, 10));
    expect(w.weekLabel).toBe("2026-07-13 ~ 2026-07-19");
    expect(w.lastDay.getDay()).toBe(0); // 일요일
  });
});
