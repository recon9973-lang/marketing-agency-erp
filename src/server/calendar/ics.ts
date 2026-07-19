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

/** RFC 5545 §3.3.11 역-이스케이프: \\ \; \, \n(\N) 복원. buildIcs escapeIcsText의 역연산. */
export function unescapeIcsText(value: string): string {
  // 단일 패스 — 역슬래시 뒤 한 글자만 해석(과잉 복원 방지).
  return value.replace(/\\([\\;,nN])/g, (_m, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

export type ParsedIcsEvent = {
  uid: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
};

/**
 * 외부 .ics(구글·애플·아웃룩·네이버) → 이벤트 목록. buildIcs의 역방향(가져오기).
 * 시간대 규칙(한국 대행사 기준): 값이 Z면 UTC, TZID=Asia/Seoul(또는 Tokyo)면 +09:00,
 * TZID 없는 floating은 KST로 간주, UTC/GMT는 Z. 그 외 TZID는 최선노력으로 KST 처리.
 * 날짜만(VALUE=DATE)인 종일 일정은 KST 자정 시작으로 본다.
 */
export function parseIcs(raw: string): ParsedIcsEvent[] {
  // 1) 라인 언폴딩 — CRLF/LF 다음 공백·탭은 이어지는 줄.
  const unfolded = raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").replace(/\r[ \t]/g, "");
  const lines = unfolded.split(/\r\n|\n|\r/);

  const events: ParsedIcsEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (cur) {
        const built = buildEvent(cur);
        if (built) events.push(built);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const left = trimmed.slice(0, colon); // NAME[;PARAM=..]
    const value = trimmed.slice(colon + 1);
    const semi = left.indexOf(";");
    const name = (semi < 0 ? left : left.slice(0, semi)).toUpperCase();
    const params = semi < 0 ? "" : left.slice(semi + 1);
    // 같은 이름이 여러 번이면 첫 값 유지(대개 DTSTART/UID는 단일).
    if (!(name in cur)) cur[name] = { params, value };
  }

  return events;
}

function buildEvent(fields: Record<string, { params: string; value: string }>): ParsedIcsEvent | null {
  const dtstart = fields["DTSTART"];
  if (!dtstart) return null; // DTSTART 없는 VEVENT는 스킵(유효한 일정 아님).
  const start = parseIcsDate(dtstart.value, dtstart.params);
  if (!start) return null;

  const dtend = fields["DTEND"];
  let end = dtend ? parseIcsDate(dtend.value, dtend.params) : null;
  if (!end) {
    // DTEND 없으면 종일은 +1일, 시간 일정은 +1시간.
    const ms = start.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    end = { date: new Date(start.date.getTime() + ms), allDay: start.allDay };
  }
  // 종료가 시작보다 빠르면(잘못된 소스) 최소 구간 보정.
  if (end.date.getTime() <= start.date.getTime()) {
    end = { date: new Date(start.date.getTime() + 60 * 60 * 1000), allDay: start.allDay };
  }

  const title = unescapeIcsText(fields["SUMMARY"]?.value ?? "").trim() || "(제목 없음)";
  const description = fields["DESCRIPTION"]?.value ? unescapeIcsText(fields["DESCRIPTION"].value).trim() : null;
  const location = fields["LOCATION"]?.value ? unescapeIcsText(fields["LOCATION"].value).trim() : null;
  const uid = fields["UID"]?.value?.trim() || null;

  return { uid, title, description: description || null, location: location || null, startsAt: start.date, endsAt: end.date, allDay: start.allDay };
}

/** TZID/floating을 오프셋 문자열로. 기본은 KST(+09:00) — 한국 대행사 운영 기준. */
function tzOffset(tzid: string | undefined): string {
  if (!tzid) return "+09:00";
  const t = tzid.toUpperCase();
  if (t.includes("SEOUL") || t.includes("TOKYO") || t.includes("KST") || t.includes("JST")) return "+09:00";
  if (t === "UTC" || t === "GMT" || t.includes("ETC/UTC")) return "Z";
  return "+09:00"; // 미상 TZID는 최선노력으로 KST(대부분 국내 일정).
}

/** iCalendar DATE/DATE-TIME 값 → Date. 파싱 실패 시 null. */
function parseIcsDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  const dateOnly = /VALUE=DATE(?![-])/i.test(params) || /^\d{8}$/.test(v);
  if (dateOnly) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if (!m) return null;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    return Number.isNaN(d.getTime()) ? null : { date: d, allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, da, h, mi, s, z] = m;
  const suffix = z === "Z" ? "Z" : tzOffset(/TZID=([^;:]+)/i.exec(params)?.[1]);
  const d = new Date(`${y}-${mo}-${da}T${h}:${mi}:${s}${suffix}`);
  return Number.isNaN(d.getTime()) ? null : { date: d, allDay: false };
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
