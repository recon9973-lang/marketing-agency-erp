import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldLine, parseIcs, toIcsUtc, unescapeIcsText, type IcsEvent } from "./ics";

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

describe("ics · unescapeIcsText(역-이스케이프)", () => {
  it("escapeIcsText의 역연산", () => {
    expect(unescapeIcsText("a\\,b\\;c\\\\d")).toBe("a,b;c\\d");
    expect(unescapeIcsText("line1\\nline2")).toBe("line1\nline2");
    // 왕복(round-trip) 보존
    const s = "미팅, 원장님; 경로\\준비\n2층";
    expect(unescapeIcsText(escapeIcsText(s))).toBe(s);
  });
});

describe("ics · parseIcs(가져오기)", () => {
  const CRLF = "\r\n";
  function ics(...vevents: string[]): string {
    return ["BEGIN:VCALENDAR", "VERSION:2.0", ...vevents, "END:VCALENDAR"].join(CRLF) + CRLF;
  }

  it("UTC(Z) DATE-TIME 이벤트 파싱", () => {
    const text = ics(
      "BEGIN:VEVENT",
      "UID:abc@google.com",
      "SUMMARY:미소진의원 리뷰",
      "DESCRIPTION:월간 점검",
      "LOCATION:본원 2층",
      "DTSTART:20260720T010000Z",
      "DTEND:20260720T020000Z",
      "END:VEVENT"
    );
    const [e] = parseIcs(text);
    expect(e.uid).toBe("abc@google.com");
    expect(e.title).toBe("미소진의원 리뷰");
    expect(e.description).toBe("월간 점검");
    expect(e.location).toBe("본원 2층");
    expect(e.startsAt.toISOString()).toBe("2026-07-20T01:00:00.000Z");
    expect(e.endsAt.toISOString()).toBe("2026-07-20T02:00:00.000Z");
    expect(e.allDay).toBe(false);
  });

  it("TZID=Asia/Seoul은 +09:00로 해석", () => {
    const text = ics(
      "BEGIN:VEVENT",
      "UID:1",
      "SUMMARY:회의",
      "DTSTART;TZID=Asia/Seoul:20260720T100000",
      "DTEND;TZID=Asia/Seoul:20260720T110000",
      "END:VEVENT"
    );
    const [e] = parseIcs(text);
    // 10:00 KST = 01:00 UTC
    expect(e.startsAt.toISOString()).toBe("2026-07-20T01:00:00.000Z");
    expect(e.endsAt.toISOString()).toBe("2026-07-20T02:00:00.000Z");
  });

  it("TZID 없는 floating은 KST로 간주", () => {
    const text = ics("BEGIN:VEVENT", "UID:2", "SUMMARY:일정", "DTSTART:20260720T090000", "END:VEVENT");
    const [e] = parseIcs(text);
    expect(e.startsAt.toISOString()).toBe("2026-07-20T00:00:00.000Z"); // 09:00 KST
  });

  it("종일(VALUE=DATE)은 KST 자정 시작 + DTEND 없으면 +1일", () => {
    const text = ics("BEGIN:VEVENT", "UID:3", "SUMMARY:워크숍", "DTSTART;VALUE=DATE:20260720", "END:VEVENT");
    const [e] = parseIcs(text);
    expect(e.allDay).toBe(true);
    expect(e.startsAt.toISOString()).toBe("2026-07-19T15:00:00.000Z"); // 2026-07-20 00:00 KST
    expect(e.endsAt.getTime() - e.startsAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("DTEND 없는 시간 일정은 +1시간", () => {
    const text = ics("BEGIN:VEVENT", "UID:4", "SUMMARY:콜", "DTSTART:20260720T010000Z", "END:VEVENT");
    const [e] = parseIcs(text);
    expect(e.endsAt.getTime() - e.startsAt.getTime()).toBe(60 * 60 * 1000);
  });

  it("접힌 줄(75옥텟 폴딩) 복원", () => {
    const long = "가".repeat(60);
    const folded = foldLine("SUMMARY:" + long); // 내부에서 CRLF+공백으로 접힘
    const text = ics("BEGIN:VEVENT", "UID:5", folded, "DTSTART:20260720T010000Z", "END:VEVENT");
    const [e] = parseIcs(text);
    expect(e.title).toBe(long);
  });

  it("이스케이프된 SUMMARY/DESCRIPTION 복원", () => {
    const text = ics(
      "BEGIN:VEVENT",
      "UID:6",
      "SUMMARY:미팅\\, 원장님",
      "DESCRIPTION:1줄\\n2줄",
      "DTSTART:20260720T010000Z",
      "END:VEVENT"
    );
    const [e] = parseIcs(text);
    expect(e.title).toBe("미팅, 원장님");
    expect(e.description).toBe("1줄\n2줄");
  });

  it("여러 VEVENT · DTSTART 없는 블록은 스킵", () => {
    const text = ics(
      "BEGIN:VEVENT", "UID:a", "SUMMARY:A", "DTSTART:20260720T010000Z", "END:VEVENT",
      "BEGIN:VEVENT", "UID:b", "SUMMARY:잘못된 일정", "END:VEVENT", // DTSTART 없음 → 스킵
      "BEGIN:VEVENT", "UID:c", "SUMMARY:C", "DTSTART:20260721T010000Z", "END:VEVENT"
    );
    const evs = parseIcs(text);
    expect(evs.map((e) => e.uid)).toEqual(["a", "c"]);
  });

  it("SUMMARY 없으면 (제목 없음), 종료<시작이면 +1시간 보정", () => {
    const text = ics("BEGIN:VEVENT", "UID:7", "DTSTART:20260720T020000Z", "DTEND:20260720T010000Z", "END:VEVENT");
    const [e] = parseIcs(text);
    expect(e.title).toBe("(제목 없음)");
    expect(e.endsAt.getTime()).toBe(e.startsAt.getTime() + 60 * 60 * 1000);
  });

  it("buildIcs 출력물을 되읽으면 원본 이벤트 복원(왕복)", () => {
    const src: IcsEvent[] = [
      { id: "e1", title: "미소진, 리뷰", description: "월간\n점검", startsAt: new Date("2026-07-20T01:00:00Z"), endsAt: new Date("2026-07-20T02:00:00Z") }
    ];
    const out = buildIcs(src, { calName: "VENOM", now: NOW });
    const [e] = parseIcs(out);
    expect(e.title).toBe("미소진, 리뷰");
    expect(e.description).toBe("월간\n점검");
    expect(e.startsAt.toISOString()).toBe("2026-07-20T01:00:00.000Z");
    expect(e.endsAt.toISOString()).toBe("2026-07-20T02:00:00.000Z");
  });

  it("VEVENT 없으면 빈 배열", () => {
    expect(parseIcs(ics())).toEqual([]);
    expect(parseIcs("쓰레기 텍스트")).toEqual([]);
  });
});
