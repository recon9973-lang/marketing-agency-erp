// JSON 공지 API 경량 파서 — 네이버 플레이스/카페 공지처럼 RSS가 아닌 JSON 응답을
// 스키마에 의존하지 않고 추출한다. (응답 구조를 사전에 알 수 없어 방어적으로 키를 탐색)
//
// 전략: JSON 안에서 "제목류 필드를 가진 객체 배열" 중 가장 큰 것을 공지 목록으로 보고,
//       각 객체에서 제목/링크/날짜/식별자를 후보 키 이름들로 유연하게 뽑는다.

import type { ParsedFeedItem } from "@/server/marketing/platform-updates/parse";

const TITLE_KEYS = /^(title|subject|question|headline|head|noticeTitle|name)$/i;
const LINK_KEYS = /^(url|link|href|linkUrl|pcUrl|mobileUrl|landingUrl|contentUrl)$/i;
const DATE_KEYS = /^(pubDate|regDate|regDt|registerDate|noticeDate|createdAt|created|startDate|date|displayDate|regdate)$/i;
const ID_KEYS = /^(id|seq|no|noticeId|articleId|contentsId|key)$/i;
const BODY_KEYS = /^(summary|content|contents|body|description|desc|contentText)$/i;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function firstByKey(obj: Obj, re: RegExp): unknown {
  for (const k of Object.keys(obj)) if (re.test(k)) return obj[k];
  return undefined;
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

function toPlain(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function parseDate(v: unknown): Date | null {
  if (typeof v === "number") {
    // epoch(초/밀리초) 추정
    const ms = v > 1e12 ? v : v > 1e9 ? v * 1000 : NaN;
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  const s = asStr(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

// 객체가 "공지 항목"처럼 보이는가 = 제목류 문자열 필드가 있는가.
function looksLikeItem(v: unknown): v is Obj {
  return isObj(v) && typeof firstByKey(v, TITLE_KEYS) === "string";
}

// JSON 트리를 훑어 항목처럼 보이는 객체 배열 중 가장 큰 것을 찾는다.
function findItemArray(root: unknown): Obj[] {
  let best: Obj[] = [];
  const stack: unknown[] = [root];
  const seen = new Set<unknown>();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      const items = cur.filter(looksLikeItem);
      if (items.length > best.length) best = items;
      for (const el of cur) if (el && typeof el === "object") stack.push(el);
    } else {
      for (const val of Object.values(cur as Obj)) if (val && typeof val === "object") stack.push(val);
    }
  }
  return best;
}

/** JSON 공지 응답 → 통합 항목 배열. 파싱 불가/구조 불명 시 빈 배열. */
export function parseNoticeJson(text: string): ParsedFeedItem[] {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return [];
  }

  const rows = findItemArray(root);
  const items: ParsedFeedItem[] = [];
  for (const row of rows) {
    const title = asStr(firstByKey(row, TITLE_KEYS));
    if (!title) continue;
    const link = asStr(firstByKey(row, LINK_KEYS));
    const id = asStr(firstByKey(row, ID_KEYS));
    const bodyRaw = asStr(firstByKey(row, BODY_KEYS));
    const summary = bodyRaw ? toPlain(bodyRaw).slice(0, 280) || null : null;
    items.push({
      title: toPlain(title),
      link: link || null,
      guid: id || link || null,
      summary,
      publishedAt: parseDate(firstByKey(row, DATE_KEYS))
    });
  }
  return items;
}
