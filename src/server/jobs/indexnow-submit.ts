// 목표 경로: src/server/jobs/indexnow-submit.ts
//
// 색인 자동 제출(#22) — 최근 게시된 콘텐츠 URL을 IndexNow로 제출하고 사이트맵을 핑한다.
// env(INDEXNOW_KEY·INDEXNOW_HOST) 미설정 시 사이트맵 핑만(SITEMAP_URL 있으면) 시도, 아니면 skip.
// 크론 하루 1회 권장. IndexNow 제출은 반복 안전(멱등적).

import { db } from "@/server/db";
import { indexNowConfigured, submitIndexNow, pingSitemaps } from "@/server/integrations/indexnow";

export type IndexNowJobResult = {
  candidates: number;
  submitted: number;
  skipped: number;
  status: number | null;
  sitemapPinged: boolean;
  note?: string;
};

/** 최근 sinceDays일 내 게시된(publishedUrl 보유) ContentPlan·Content URL을 모은다. */
async function recentPublishedUrls(sinceDays: number): Promise<string[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const [plans, posts] = await Promise.all([
    db.contentPlan.findMany({
      where: { status: "PUBLISHED", publishedUrl: { not: null }, updatedAt: { gte: since } },
      select: { publishedUrl: true }
    }),
    db.magazinePost.findMany({
      where: { status: "PUBLISHED", publishedUrl: { not: null }, updatedAt: { gte: since } },
      select: { publishedUrl: true }
    })
  ]);
  const urls = [...plans, ...posts].map((r) => r.publishedUrl).filter((u): u is string => Boolean(u));
  return Array.from(new Set(urls));
}

export async function runIndexNowSubmit(opts?: { sinceDays?: number }): Promise<IndexNowJobResult> {
  const sinceDays = opts?.sinceDays ?? 2;

  // 사이트맵 핑은 키 없이도 가능 — 먼저 시도.
  const ping = await pingSitemaps();

  if (!indexNowConfigured()) {
    return {
      candidates: 0,
      submitted: 0,
      skipped: 0,
      status: null,
      sitemapPinged: ping.ok,
      note: "INDEXNOW_NOT_CONFIGURED"
    };
  }

  const urls = await recentPublishedUrls(sinceDays);
  const res = await submitIndexNow(urls);
  return {
    candidates: urls.length,
    submitted: res.submitted,
    skipped: res.skipped,
    status: res.status,
    sitemapPinged: ping.ok,
    note: res.reason
  };
}
