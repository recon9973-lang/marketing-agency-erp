// 자동 수집 소스 레지스트리.
// - 구글 Search Central 블로그(Atom)는 공식·안정적이라 내장.
// - 네이버는 안정적 공식 RSS가 드물어 기본 내장은 두지 않고, 환경변수로 신뢰하는
//   블로그 RSS(예: 네이버 공식 블로그 rss.blog.naver.com/<id>.xml)를 추가하도록 한다.
//   못 잡는 공지는 관리자 수동 등록으로 보완한다(하이브리드).

import type { PlatformKind, UpdateCategory } from "@/domain/platform-updates";

export type FeedSource = {
  sourceId: string; // dedup·표기용 안정 식별자
  platform: PlatformKind;
  url: string;
  defaultCategory: UpdateCategory; // 제목 추론 실패 시 사용
};

const BUILT_IN: FeedSource[] = [
  // 구글 검색 공식 블로그(Atom) — 알고리즘·코어 업데이트·SEO·AI Overviews(GEO) 공지.
  {
    sourceId: "google-search-central",
    platform: "GOOGLE",
    url: "https://developers.google.com/search/blog/feed.xml",
    defaultCategory: "SEO"
  },
  // 네이버 서치앤테크(NAVER Search & Tech) 공식 기술 블로그 — 검색 알고리즘·블로그(C-Rank/DIA)·
  // 생성형 AI 문서 정책 등 검색 관련 공지의 1차 채널. RSS는 네이버 표준 패턴(rss.blog.naver.com/<id>.xml).
  // ※ 아이디 변경/오류 시 소스별로 격리되어 배너·다른 소스에 영향 없음. 교체·제거는 PLATFORM_UPDATE_FEEDS로.
  {
    sourceId: "naver-search-tech",
    platform: "NAVER",
    url: "https://rss.blog.naver.com/naver_search.xml",
    defaultCategory: "GENERAL"
  }
];

/**
 * 환경변수 PLATFORM_UPDATE_FEEDS(JSON 배열)로 소스 추가.
 * 예: [{"sourceId":"naver-search","platform":"NAVER","url":"https://rss.blog.naver.com/naver_search.xml","defaultCategory":"GENERAL"}]
 * 파싱 실패는 조용히 무시(빌드·런타임을 막지 않음).
 */
function envFeeds(): FeedSource[] {
  const raw = process.env.PLATFORM_UPDATE_FEEDS;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (f): f is FeedSource =>
          f && typeof f.sourceId === "string" && typeof f.url === "string" &&
          (f.platform === "GOOGLE" || f.platform === "NAVER" || f.platform === "ETC")
      )
      .map((f) => ({ ...f, defaultCategory: (f.defaultCategory ?? "GENERAL") as UpdateCategory }));
  } catch {
    return [];
  }
}

export function listFeedSources(): FeedSource[] {
  const env = envFeeds();
  // sourceId 중복 시 환경변수가 우선(운영에서 URL 교체 가능).
  const bySource = new Map<string, FeedSource>();
  for (const s of [...BUILT_IN, ...env]) bySource.set(s.sourceId, s);
  return [...bySource.values()];
}
