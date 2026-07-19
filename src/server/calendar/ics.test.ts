import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldLine, toIcsUtc, type IcsEvent } from "./ics";

const NOW = new Date("2026-07-19T01:00:00.000Z");

describe("ics · toIcsUtc", () => {
  it("Date → YYYYMMDDTHHMMSSZ", () => {
    expect(toIcsUtc(new Date("2026-07-19T01:00:00.000Z"))).toBe("20260719T010000Z");
    expect(toIcsUtc(new Date("2026-12-31T23:59:00.000Z"))).toBe("20261231T235900Z");
  });
});

describe("ics · escapeIcsText(RFC 5545)", () => {
  it("쉼표·세미콜론·역슬래시·줄바꿈 이스케이프", () => {
    expect(escapeIcsText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2");
  });
});

describe("ics · foldLine(75옥텟)", () => {
  it("짧은 줄은 그대로", () => {
    expect(foldLine("SUMMARY:hi")).toBe("SUMMARY:hi");
  });
  it("긴 줄은 CRLF+공백으로 접힘, 멀티바이트 분리 없음", () => {
    const long = "DESCRIPTION:" + "가".repeat(60); // 한글 3바이트 × 60 = 180B
    const folded = foldLine(long);
    expect(folded).toContain("\r\n ");
    // 각 물리 줄이 75옥텟 이하인지(연속줄 공백 포함).
    const enc = new TextEncoder();
    for (const physical of folded.split("\r\n")) {
      expect(enc.encode(physical).length).toBeLessThanOrEqual(75);
    }
    // 접힘 해제 시 원문 복원(공백 접합 제거).
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });
});

describe("ics · buildIcs", () => {
  const events: IcsEvent[] = [
    { id: "e1", title: "미소진의원 리뷰", description: "월간 점검", startsAt: new Date("2026-07-20T01:00:00Z"), endsAt: new Date("2026-07-20T02:00:00Z") },
    { id: "e2", title: "휴가", description: null, startsAt: new Date("2026-07-21T00:00:00Z"), endsAt: new Date("2026-07-21T09:00:00Z") }
  ];

  it("VCALENDAR 골격 + 이벤트별 VEVENT", () => {
    const ics = buildIcs(events, { calName: "VENOM 일정", now: NOW });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect(ics).toContain("UID:e1@venom-erp");
    expect(ics).toContain("DTSTAMP:20260719T010000Z");
    expect(ics).toContain("DTSTART:20260720T010000Z");
    expect(ics).toContain("DTEND:20260720T020000Z");
    expect(ics).toContain("SUMMARY:미소진의원 리뷰");
  });

  it("모든 줄이 CRLF, 설명 없으면 DESCRIPTION 생략", () => {
    const ics = buildIcs(events, { calName: "VENOM 일정", now: NOW });
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics.split("\n").every((l) => l === "" || l.endsWith("\r"))).toBe(true);
    // e2는 description null → 해당 VEVENT에 DESCRIPTION 없음
    const e2Block = ics.slice(ics.indexOf("UID:e2@venom-erp"));
    expect(e2Block).not.toContain("DESCRIPTION:");
  });

  it("빈 목록도 유효한 VCALENDAR", () => {
    const ics = buildIcs([], { calName: "빈 일정", now: NOW });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
