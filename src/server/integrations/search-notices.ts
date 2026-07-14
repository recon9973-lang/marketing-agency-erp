// 검색엔진 공식 공지 수집 — Google Search Central / Google 검색 상태 / 네이버 검색.
// 서버에서 런타임에 피드를 받아 파싱(1시간 캐시). 외부 차단·형식 변경 시엔
// 폴백(공식 공지 페이지 링크)으로 항상 무언가는 보여준다.
//
// ⚠️ 샌드박스(개발)에서는 외부 HTTPS가 정책상 막혀 degraded로 뜬다.
//    배포(Vercel) 런타임에서는 직접 나가므로 실제 피드가 로드된다.
import "server-only";

export type NoticeSource = "google" | "naver";
export type SearchNotice = {
  source: NoticeSource;
  sourceLabel: string;
  title: string;
  url: string;
  date: string | null; // ISO 문자열
};

type Feed = { source: NoticeSource; label: string; url: string };

// 공식 피드(안정적인 RSS/Atom 우선). URL만 바꾸면 소스 교체 가능.
const FEEDS: Feed[] = [
  { source: "google", label: "Google 검색 블로그", url: "https://developers.google.com/search/blog/feed.xml" },
  { source: "google", label: "Google 검색 상태", url: "https://status.search.google.com/en/feed.atom" },
  { source: "naver", label: "네이버 검색 블로그", url: "https://rss.blog.naver.com/naver_search.xml" }
];

// 피드 실패 시 항상 보여줄 공식 공지 페이지(사람이 직접 열도록).
const FALLBACK: SearchNotice[] = [
  { source: "google", sourceLabel: "Google 검색 블로그", title: "구글 검색 공식 블로그 — 알고리즘·랭킹 업데이트 공지", url: "https://developers.google.com/search/blog?hl=ko", date: null },
  { source: "google", sourceLabel: "Google 검색 상태", title: "구글 검색 상태 대시보드 — 인덱싱·랭킹 장애 이력", url: "https://status.search.google.com/", date: null },
  { source: "naver", sourceLabel: "네이버 서치어드바이저", title: "네이버 서치어드바이저 공지사항", url: "https://searchadvisor.naver.com/notice", date: null }
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "") // 잔여 태그 제거
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? m[1] : null;
}

function toIso(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// Atom(<entry>)·RSS(<item>) 모두에서 제목/링크/날짜를 뽑는다.
function parseFeed(xml: string, feed: Feed, perFeed: number): SearchNotice[] {
  const blocks = xml.match(/<(entry|item)[\s>][\s\S]*?<\/(entry|item)>/g) ?? [];
  const out: SearchNotice[] = [];
  for (const block of blocks) {
    const title = decodeEntities(firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/) ?? "");
    // Atom: <link href="...">, RSS: <link>...</link>
    const atomHref = firstMatch(block, /<link[^>]*href="([^"]+)"[^>]*\/?>/);
    const rssLink = firstMatch(block, /<link>([\s\S]*?)<\/link>/);
    const url = (atomHref ?? (rssLink ? decodeEntities(rssLink) : null))?.trim() ?? null;
    const date = toIso(
      firstMatch(block, /<updated[^>]*>([\s\S]*?)<\/updated>/) ??
      firstMatch(block, /<published[^>]*>([\s\S]*?)<\/published>/) ??
      firstMatch(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) ??
      firstMatch(block, /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/)
    );
    if (title && url) out.push({ source: feed.source, sourceLabel: feed.label, title, url, date });
    if (out.length >= perFeed) break;
  }
  return out;
}

/**
 * 검색엔진 공지 최신 N개. 하나라도 성공하면 degraded=false.
 * 전부 실패(차단/형식오류)면 폴백 링크를 degraded=true로 돌려준다.
 */
export async function getSearchNotices(limit = 6, perFeed = 4): Promise<{ items: SearchNotice[]; degraded: boolean }> {
  const settled = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      // 피드가 응답을 안 하면 서버리스 함수 타임아웃 → 화면 로드 실패로 이어진다.
      // 피드당 4초로 강제 중단 → 실패한 피드는 폴백/스킵(allSettled가 흡수).
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(feed.url, {
          // 1시간 캐시(ISR). UA 지정 — 일부 피드가 기본 UA를 막음.
          next: { revalidate: 3600 },
          headers: { "user-agent": "Mozilla/5.0 (compatible; VENOM-ERP/1.0; +https://venom.example)" },
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`${feed.url} → ${res.status}`);
        return parseFeed(await res.text(), feed, perFeed);
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const anyOk = items.length > 0;
  if (!anyOk) return { items: FALLBACK, degraded: true };

  items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { items: items.slice(0, limit), degraded: false };
}
