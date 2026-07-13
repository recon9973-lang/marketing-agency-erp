import { describe, expect, it } from "vitest";
import { parseFeed } from "@/server/marketing/platform-updates/parse";
import { parseNoticeJson } from "@/server/marketing/platform-updates/parse-json";
import { inferCategory, isNewUpdate } from "@/domain/platform-updates";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>네이버 공식 블로그</title>
  <item>
    <title><![CDATA[네이버 스마트플레이스 순위 로직 업데이트]]></title>
    <link>https://blog.naver.com/naver_search/1</link>
    <guid>https://blog.naver.com/naver_search/1</guid>
    <description><![CDATA[<p>플레이스 <b>랭킹</b> 개선 안내</p>]]></description>
    <pubDate>Mon, 06 Jul 2026 09:00:00 +0900</pubDate>
  </item>
  <item>
    <title>블로그 C-Rank 관련 공지</title>
    <link>https://blog.naver.com/naver_search/2</link>
    <guid>guid-2</guid>
    <pubDate>Sun, 05 Jul 2026 09:00:00 +0900</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Google Search Central Blog</title>
  <entry>
    <title>March 2026 core update</title>
    <link rel="alternate" href="https://developers.google.com/search/blog/2026/03/core-update"/>
    <id>tag:google.com,2026:core</id>
    <summary>We are rolling out a core algorithm update.</summary>
    <published>2026-03-10T10:00:00Z</published>
    <updated>2026-03-11T10:00:00Z</updated>
  </entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS 2.0 items with CDATA, links, and dates", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("네이버 스마트플레이스 순위 로직 업데이트");
    expect(items[0].link).toBe("https://blog.naver.com/naver_search/1");
    expect(items[0].guid).toBe("https://blog.naver.com/naver_search/1");
    expect(items[0].summary).toBe("플레이스 랭킹 개선 안내"); // HTML 제거 + 엔티티 처리
    expect(items[0].publishedAt?.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(items[1].guid).toBe("guid-2");
  });

  it("parses Atom entries and prefers rel=alternate link", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("March 2026 core update");
    expect(items[0].link).toBe("https://developers.google.com/search/blog/2026/03/core-update");
    expect(items[0].guid).toBe("tag:google.com,2026:core");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-03-10T10:00:00.000Z");
  });

  it("returns an empty array for junk input", () => {
    expect(parseFeed("")).toEqual([]);
    expect(parseFeed("<html>not a feed</html>")).toEqual([]);
  });
});

describe("parseNoticeJson", () => {
  // 네이버 통합 공지센터류의 흔한 형태(중첩 + 배열) — 스키마 비의존 추출 검증.
  const JSON_BODY = JSON.stringify({
    result: {
      total: 2,
      list: [
        { noticeId: 101, title: "카페 검색 노출 정책 변경 안내", regDate: "2026-07-10T09:00:00+09:00", linkUrl: "https://notice.naver.com/notices/cafe/101", contents: "<p>변경 내용</p>" },
        { noticeId: 102, subject: "카페 스팸 필터 업데이트", regDt: 1751500800000 }
      ]
    }
  });

  it("extracts notice items regardless of exact schema", () => {
    const items = parseNoticeJson(JSON_BODY);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("카페 검색 노출 정책 변경 안내");
    expect(items[0].link).toBe("https://notice.naver.com/notices/cafe/101");
    expect(items[0].guid).toBe("101");
    expect(items[0].summary).toBe("변경 내용");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-07-10T00:00:00.000Z");
    expect(items[1].title).toBe("카페 스팸 필터 업데이트"); // subject 키도 인식
    expect(items[1].publishedAt).toBeInstanceOf(Date); // epoch(ms) 파싱
  });

  it("returns an empty array for non-JSON or itemless payloads", () => {
    expect(parseNoticeJson("<html>notice</html>")).toEqual([]);
    expect(parseNoticeJson(JSON.stringify({ ok: true, data: [] }))).toEqual([]);
  });
});

describe("inferCategory", () => {
  it("maps Naver service keywords", () => {
    expect(inferCategory("스마트플레이스 순위 로직 업데이트", "GENERAL")).toBe("PLACE");
    expect(inferCategory("네이버 카페 검색 노출 변경", "GENERAL")).toBe("CAFE");
    expect(inferCategory("블로그 C-Rank 개편", "GENERAL")).toBe("BLOG");
  });

  it("maps algorithm and generative-search keywords", () => {
    expect(inferCategory("March 2026 core update", "SEO")).toBe("ALGORITHM");
    expect(inferCategory("AI Overviews expands to more queries", "SEO")).toBe("GEO");
  });

  it("falls back to the source default", () => {
    expect(inferCategory("Some unrelated announcement", "SEO")).toBe("SEO");
    expect(inferCategory("무관한 공지", "GENERAL")).toBe("GENERAL");
  });
});

describe("isNewUpdate", () => {
  const now = Date.parse("2026-07-13T00:00:00Z");
  it("is NEW within the window and not after", () => {
    expect(isNewUpdate("2026-07-10T00:00:00Z", now)).toBe(true);
    expect(isNewUpdate("2026-06-01T00:00:00Z", now)).toBe(false);
  });
});
