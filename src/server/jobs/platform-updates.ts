// 목표 경로: src/server/jobs/platform-updates.ts
//
// 플랫폼 공지·업데이트 자동 수집 잡 — 등록된 RSS/Atom 소스를 당겨 새 항목만 저장(멱등).
// externalKey(소스+guid/link)로 dedup. 소스별 오류는 격리(한 피드 실패가 전체를 막지 않음).
// 발행 주기: 크론(near-real-time, 기본 3시간) + 관리자 온디맨드 새로고침 + 일일 백업.

import { db } from "@/server/db";
import { inferCategory, type UpdateCategory } from "@/domain/platform-updates";
import { parseFeed } from "@/server/marketing/platform-updates/parse";
import { listFeedSources } from "@/server/marketing/platform-updates/sources";

export type PlatformUpdatesSyncResult = { sources: number; fetched: number; inserted: number; failed: number };

const PER_FEED_LIMIT = 30; // 피드당 최신 N건만 반영(과거 대량 유입 방지)
const FETCH_TIMEOUT_MS = 15000;

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "marketing-agency-erp/1.0 (+platform-updates)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 자동 수집 실행 — 소스 순회하며 새 항목 upsert. */
export async function runPlatformUpdatesSync(): Promise<PlatformUpdatesSyncResult> {
  const sources = listFeedSources();
  const result: PlatformUpdatesSyncResult = { sources: sources.length, fetched: 0, inserted: 0, failed: 0 };

  for (const source of sources) {
    try {
      const xml = await fetchText(source.url);
      const items = parseFeed(xml).slice(0, PER_FEED_LIMIT);
      result.fetched += items.length;

      for (const item of items) {
        const dedup = item.guid || item.link || item.title;
        const externalKey = `${source.sourceId}:${dedup}`;
        const category: UpdateCategory = inferCategory(item.title, source.defaultCategory);
        const publishedAt = item.publishedAt ?? new Date();

        try {
          // 이미 있으면 제목/요약만 갱신(수정된 공지 반영), 없으면 생성 → inserted 카운트.
          const existing = await db.platformUpdate.findUnique({ where: { externalKey }, select: { id: true } });
          if (existing) {
            await db.platformUpdate.update({
              where: { externalKey },
              data: { title: item.title, summary: item.summary, url: item.link, category }
            });
          } else {
            await db.platformUpdate.create({
              data: {
                platform: source.platform,
                category,
                title: item.title,
                url: item.link,
                summary: item.summary,
                source: source.sourceId,
                externalKey,
                publishedAt,
                isManual: false
              }
            });
            result.inserted++;
          }
        } catch (e) {
          console.error("[platform-updates] item upsert failed", externalKey, e);
          result.failed++;
        }
      }
    } catch (e) {
      console.error("[platform-updates] source fetch failed", source.sourceId, e);
      result.failed++;
    }
  }

  if (result.inserted > 0) {
    await db.auditLog
      .create({ data: { actorId: null, action: "platformUpdate.sync", targetType: "PlatformUpdate", targetId: "batch", afterState: { inserted: result.inserted } } })
      .catch(() => {});
  }

  return result;
}
