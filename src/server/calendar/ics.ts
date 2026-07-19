// 자체 캘린더 · iCalendar(.ics) 내보내기 — 순수 함수(외부 의존 없음).
// 재설계 원칙: 자체 캘린더가 본체, 외부(구글·애플·아웃룩)는 표준 .ics로 "내보내기".
// RFC 5545 최소 준수: CRLF 줄바꿈, 텍스트 이스케이프, 75옥텟 폴딩.

export type IcsEvent = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
};

/** Date → iCalendar UTC 타임스탬프(YYYYMMDDTHHMMSSZ). */
export function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** RFC 5545 §3.3.11 텍스트 이스케이프: \\ , ; 및 줄바꿈. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** RFC 5545 §3.1 라인 폴딩 — 75옥텟 초과 시 CRLF+공백. 멀티바이트 문자 분리 금지. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  let out = "";
  let seg = "";
  let segBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (segBytes + b > 73) {
      out += (out ? "\r\n " : "") + seg;
      seg = ch;
      segBytes = b;
    } else {
      seg += ch;
      segBytes += b;
    }
  }
  out += (out ? "\r\n " : "") + seg;
  return out;
}

function prop(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

/** 이벤트 목록 → VCALENDAR 문자열(.ics). now는 DTSTAMP용(테스트 결정성 위해 주입 가능). */
export function buildIcs(events: IcsEvent[], opts: { calName: string; now: Date; domain?: string }): string {
  const domain = opts.domain ?? "venom-erp";
  const stamp = toIcsUtc(opts.now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//VENOM ERP//Calendar//KO`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    prop("X-WR-CALNAME", escapeIcsText(opts.calName))
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(prop("UID", `${e.id}@${domain}`));
    lines.push(prop("DTSTAMP", stamp));
    lines.push(prop("DTSTART", toIcsUtc(e.startsAt)));
    lines.push(prop("DTEND", toIcsUtc(e.endsAt)));
    lines.push(prop("SUMMARY", escapeIcsText(e.title)));
    if (e.description) lines.push(prop("DESCRIPTION", escapeIcsText(e.description)));
    if (e.location) lines.push(prop("LOCATION", escapeIcsText(e.location)));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
