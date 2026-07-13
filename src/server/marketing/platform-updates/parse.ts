// RSS 2.0 / Atom 피드 경량 파서 — 외부 의존성 없이 항목만 추출한다.
// 잘 구성된(well-formed) 공개 피드 기준. 실패에 강하도록 필드 누락은 건너뛴다.
// (구글 Search Central=Atom, 네이버 블로그 RSS=RSS 2.0 모두 커버)

export type ParsedFeedItem = {
  title: string;
  link: string | null;
  guid: string | null;
  summary: string | null;
  publishedAt: Date | null;
};

function stripCdata(raw: string): string {
  const m = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (m ? m[1] : raw).trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// HTML 태그 제거 + 공백 정리 — 요약을 짧은 평문으로.
function toPlainText(html: string): string {
  return decodeEntities(stripCdata(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function firstTag(block: string, tag: string): string | null {
  // <tag ...>inner</tag> 또는 self-closing <tag .../> (Atom link)
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1] : null;
}

// Atom link: <link href="..." rel="alternate"/> — rel=alternate(또는 rel 없음)의 href 우선.
function atomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>(?:<\/link>)?/gi)];
  let fallback: string | null = null;
  for (const m of links) {
    const attrs = m[1];
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
    if (!href) continue;
    const rel = attrs.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!rel || rel.toLowerCase() === "alternate") return href.trim();
    fallback = fallback ?? href.trim();
  }
  return fallback;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isFinite(t) ? new Date(t) : null;
}

/** RSS 2.0 <item> / Atom <entry> 를 통합 파싱. 항목 배열 반환(파싱 불가 시 빈 배열). */
export function parseFeed(xml: string): ParsedFeedItem[] {
  if (typeof xml !== "string" || xml.length === 0) return [];

  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blockTag = isAtom ? "entry" : "item";
  const blocks = [...xml.matchAll(new RegExp(`<${blockTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${blockTag}>`, "gi"))];

  const items: ParsedFeedItem[] = [];
  for (const b of blocks) {
    const block = b[1];
    const rawTitle = firstTag(block, "title");
    const title = rawTitle ? toPlainText(rawTitle) : "";
    if (!title) continue;

    const link = isAtom ? atomLink(block) : (firstTag(block, "link") ? stripCdata(firstTag(block, "link") as string) : null);

    const guidRaw = isAtom ? firstTag(block, "id") : firstTag(block, "guid");
    const guid = guidRaw ? stripCdata(guidRaw) : null;

    const summaryRaw =
      firstTag(block, "description") ??
      firstTag(block, "summary") ??
      firstTag(block, "content") ??
      firstTag(block, "content:encoded");
    const summary = summaryRaw ? toPlainText(summaryRaw).slice(0, 280) || null : null;

    const dateRaw =
      firstTag(block, "pubDate") ??
      firstTag(block, "published") ??
      firstTag(block, "updated") ??
      firstTag(block, "dc:date");
    const publishedAt = parseDate(dateRaw ? stripCdata(dateRaw) : null);

    items.push({ title, link: link?.trim() || null, guid: guid?.trim() || null, summary, publishedAt });
  }
  return items;
}
