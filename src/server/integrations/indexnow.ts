// 목표 경로: src/server/integrations/indexnow.ts
//
// IndexNow 색인 제출 + 사이트맵 핑(#22). 게시된 URL을 검색엔진에 즉시 알려 색인을 앞당긴다.
// - IndexNow: Bing·Naver·Yandex 등이 지원하는 공용 프로토콜. host 루트에 {key}.txt 키파일 필요.
// - 사이트맵 핑: 키 불필요. sitemap URL만 있으면 검색엔진에 갱신 알림.
// 미설정(env 없음) 시 안전하게 skip — 기존 통합(naver-search)의 no-op 규약과 동일.

export function indexNowConfigured(): boolean {
  return Boolean(process.env.INDEXNOW_KEY && process.env.INDEXNOW_HOST);
}

/** URL이 지정 host에 속하는 http(s) 절대 URL인지 검증(다른 도메인 제출 방지 — IndexNow 403 회피). */
export function isSameHostUrl(url: string, host: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && u.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export type IndexNowResult = { ok: boolean; submitted: number; skipped: number; status: number | null; reason?: string };

/**
 * IndexNow 일괄 제출. host에 속한 URL만 최대 10,000개 제출한다.
 * env INDEXNOW_KEY(키), INDEXNOW_HOST(도메인), INDEXNOW_KEY_LOCATION(선택 키파일 URL) 사용.
 */
export async function submitIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  const host = process.env.INDEXNOW_HOST;
  if (!key || !host) return { ok: false, submitted: 0, skipped: urls.length, status: null, reason: "NOT_CONFIGURED" };

  const unique = Array.from(new Set(urls.filter((u) => isSameHostUrl(u, host)))).slice(0, 10000);
  const skipped = urls.length - unique.length;
  if (unique.length === 0) return { ok: true, submitted: 0, skipped, status: null, reason: "NO_URLS" };

  const body = {
    host,
    key,
    keyLocation: process.env.INDEXNOW_KEY_LOCATION || `https://${host}/${key}.txt`,
    urlList: unique
  };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body)
    });
    // IndexNow: 200/202 = 접수. 그 외는 실패로 본다.
    const ok = res.status === 200 || res.status === 202;
    return { ok, submitted: ok ? unique.length : 0, skipped, status: res.status, reason: ok ? undefined : "HTTP_" + res.status };
  } catch (e) {
    return { ok: false, submitted: 0, skipped, status: null, reason: e instanceof Error ? e.message : "FETCH_ERROR" };
  }
}

export type SitemapPingResult = { ok: boolean; engines: { engine: string; status: number | null }[] };

/**
 * 사이트맵 핑 — 키 불필요. sitemapUrl(기본 env SITEMAP_URL)을 검색엔진에 알린다.
 * 구글은 2023년 ping 폐지 → 빙만 유효하지만, 확장 가능하도록 목록으로 유지.
 */
export async function pingSitemaps(sitemapUrl?: string): Promise<SitemapPingResult> {
  const url = sitemapUrl || process.env.SITEMAP_URL;
  if (!url) return { ok: false, engines: [] };
  const enc = encodeURIComponent(url);
  const targets: { engine: string; url: string }[] = [
    { engine: "bing", url: `https://www.bing.com/ping?sitemap=${enc}` }
  ];
  const engines = await Promise.all(
    targets.map(async (t) => {
      try {
        const res = await fetch(t.url, { method: "GET" });
        return { engine: t.engine, status: res.status };
      } catch {
        return { engine: t.engine, status: null };
      }
    })
  );
  return { ok: engines.some((e) => e.status === 200), engines };
}
