// ERP SEO 진단 — 단일 정본 파이프라인.
//
// ERP의 모든 SEO 진단은 여기를 통해 총괄 디렉터의 VENOM 엔진(벤더 사본)으로 수행된다.
// 자체 채점 로직을 두지 않는다 — 엔진/규칙은 scripts/sync-seo-engine.mjs로 항상 최신화.
//
// 서버 전용: 대상 사이트 HTML/robots.txt를 서버에서 수집해 엔진에 넘긴다(브라우저 CORS 회피).
import "server-only";

import { parseHTML } from "linkedom";
// 벤더된 UMD 엔진(정본). 직접 수정 금지 — vendor/VENDORED.md 참고.
import SEOEngine from "./vendor/seo-engine.cjs";
import type { SeoEngineResult } from "./vendor/seo-engine";

export type { SeoEngineResult, SeoEngineCategory, SeoEngineItem } from "./vendor/seo-engine";

export const SEO_ENGINE_VERSION: string = SEOEngine.version;

const FETCH_TIMEOUT_MS = 15_000;
const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const UA_GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export type SeoAuditOk = { ok: true; result: SeoEngineResult; fetchedWith: string; html: string };
export type SeoAuditErr = { ok: false; reason: string };
export type SeoAuditOutcome = SeoAuditOk | SeoAuditErr;

function normalizeUrl(raw: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

async function fetchText(url: string, ua: string): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store"
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

/** HTML에 head/메타 신호가 실렸는지 — 봇차단/빈 SPA 셸 판별용. */
function looksRendered(html: string): boolean {
  return /<head[\s>]/i.test(html) && /<title[\s>]/i.test(html);
}

/**
 * 대상 URL을 VENOM 엔진으로 진단한다.
 * @param url  진단할 홈페이지 URL(스킴 없으면 https 가정)
 * @param keyword  포커스 키워드(있으면 제목·본문 배치까지 평가)
 */
export async function runSeoAudit(url: string, keyword?: string | null): Promise<SeoAuditOutcome> {
  const target = normalizeUrl(url);
  if (!target) return { ok: false, reason: "INVALID_URL" };

  // 1) 일반 브라우저 UA → 실패/미렌더면 Googlebot UA 재시도(봇차단 우회).
  let page = await fetchText(target, UA_BROWSER);
  let fetchedWith = "browser";
  if (!page.ok || !looksRendered(page.text)) {
    const retry = await fetchText(target, UA_GOOGLEBOT);
    if (retry.ok && looksRendered(retry.text)) {
      page = retry;
      fetchedWith = "googlebot";
    }
  }
  if (!page.text) return { ok: false, reason: page.status ? `FETCH_${page.status}` : "FETCH_FAILED" };
  if (!looksRendered(page.text)) return { ok: false, reason: "NOT_RENDERED" };

  // 2) robots.txt (있으면 크롤 규칙 평가에 사용, 실패해도 진단은 진행).
  let robots = "";
  try {
    const robotsUrl = new URL("/robots.txt", target).toString();
    const r = await fetchText(robotsUrl, UA_BROWSER);
    if (r.ok) robots = r.text;
  } catch {
    /* robots 없음 — 무시 */
  }

  // 3) linkedom으로 DOM 구성 후 정본 엔진 실행(브라우저/Node 공용 API).
  try {
    const { document } = parseHTML(page.text);
    const result = SEOEngine.analyze({
      url: target,
      html: page.text,
      robots,
      isHttps: target.startsWith("https:"),
      doc: document,
      keyword: keyword || undefined
    }) as SeoEngineResult;
    return { ok: true, result, fetchedWith, html: page.text };
  } catch (err) {
    return { ok: false, reason: `ENGINE_${(err as Error).message || "ERROR"}` };
  }
}

/** 종합 점수(속도 제외)를 0–100 정수로 — 리드 auditScore 컬럼에 저장할 값. */
export function scorePct(result: SeoEngineResult): number {
  if (!result.max) return 0;
  return Math.round((result.total / result.max) * 100);
}
