import "server-only";
/**
 * 네이버 지역검색(플레이스) API — 상권분석 경쟁사 상위 표본.
 * GET https://openapi.naver.com/v1/search/local.json · 헤더 X-Naver-Client-Id/Secret
 * ⚠️ display 최대 5, total 은 표시수 캡(개수 아님) → "상위 표본"으로만 사용(스킬 §④).
 * env: NAVER_CLIENT_ID / NAVER_CLIENT_SECRET (네이버 검색 오픈API). 없으면 미연결.
 */
const ENDPOINT = "https://openapi.naver.com/v1/search/local.json";
const TIMEOUT_MS = 8000;

export function naverLocalConfigured(): boolean {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

export type LocalPlace = {
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  telephone: string;
  link: string;
};

/** 지역검색 상위 표본(최대 5). 미연결/오류 시 빈 배열. sort: comment(리뷰많은순)|random. */
export async function searchLocalPlaces(query: string, display = 5, sort: "comment" | "random" = "comment"): Promise<LocalPlace[]> {
  if (!naverLocalConfigured() || !query.trim()) return [];
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=${Math.min(5, display)}&sort=${sort}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID as string,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET as string
      }
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { items?: Record<string, string>[] };
    return (j.items ?? []).map((it) => ({
      name: stripTags(it.title ?? ""),
      category: it.category ?? "",
      address: it.address ?? "",
      roadAddress: it.roadAddress ?? "",
      telephone: it.telephone ?? "",
      link: it.link ?? ""
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const BLOG_ENDPOINT = "https://openapi.naver.com/v1/search/blog.json";

/**
 * 키워드의 네이버 블로그 발행 문서 수(포화도 산정용). 미연결/오류 시 null.
 * 동일 오픈API 키(NAVER_CLIENT_*). total = 검색된 전체 문서 수(발행량 근사).
 */
export async function fetchBlogDocCount(keyword: string): Promise<number | null> {
  if (!naverLocalConfigured() || !keyword.trim()) return null;
  const url = `${BLOG_ENDPOINT}?query=${encodeURIComponent(keyword)}&display=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID as string,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET as string
      }
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { total?: number };
    return typeof j.total === "number" ? j.total : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
