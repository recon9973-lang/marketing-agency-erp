import { describe, expect, it } from "vitest";
import { kstToUtc } from "./calendar-event-util";

describe("calendar-event · kstToUtc(KST 로컬 → UTC)", () => {
  it("KST 10:00 → UTC 01:00(-9h), 서버 TZ 무관", () => {
    const d = kstToUtc("2026-07-19", "10:00");
    expect(d.toISOString()).toBe("2026-07-19T01:00:00.000Z");
  });

  it("자정 이후 KST 00:30 → 전날 UTC 15:30", () => {
    const d = kstToUtc("2026-07-19", "00:30");
    expect(d.toISOString()).toBe("2026-07-18T15:30:00.000Z");
  });

  it("시작<종료 순서가 UTC에서도 보존", () => {
    const s = kstToUtc("2026-07-19", "10:00");
    const e = kstToUtc("2026-07-19", "11:30");
    expect(e.getTime()).toBeGreaterThan(s.getTime());
    expect(e.getTime() - s.getTime()).toBe(90 * 60 * 1000);
  });
});
