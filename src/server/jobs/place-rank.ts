// src/server/jobs/place-rank.ts
//
// 네이버 플레이스 순위 추적 — channel="place" 키워드에 대해 거래처(플레이스명=Client.name)의
// 로컬 검색 노출 순위를 측정해 PlaceRankRecord에 일자별 upsert(멱등).
// 순위를 못 찾으면(rank=null) 저장하지 않는다(PlaceRankRecord.rank는 NOT NULL).
// 크론 하루 1회. 네이버 키 미설정 시 스킵.

import { db } from "@/server/db";
import { naverResearch, naverConfigured } from "@/server/marketing/providers/naver";

export type PlaceRankResult = { clients: number; keywords: number; recorded: number; failed: number; skipped?: string };

/** recordedOn용 — 오늘 00:00 UTC(Date 컬럼). */
function today(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function runPlaceRankTracking(now = new Date()): Promise<PlaceRankResult> {
  if (!naverConfigured()) return { clients: 0, keywords: 0, recorded: 0, failed: 0, skipped: "NAVER_NOT_CONFIGURED" };

  // channel="place" 키워드를 거래처명과 함께 로드해 거래처별로 묶는다.
  const placeKeywords = await db.keyword.findMany({
    where: { channel: "place" },
    select: { keyword: true, clientId: true, client: { select: { name: true } } },
  });

  const byClient = new Map<string, { name: string; keywords: string[] }>();
  for (const k of placeKeywords) {
    const name = k.client?.name?.trim();
    if (!name) continue;
    const entry = byClient.get(k.clientId) ?? { name, keywords: [] };
    if (!entry.keywords.includes(k.keyword)) entry.keywords.push(k.keyword);
    byClient.set(k.clientId, entry);
  }

  const recordedOn = today(now);
  const result: PlaceRankResult = { clients: byClient.size, keywords: 0, recorded: 0, failed: 0 };

  for (const [clientId, { name, keywords }] of byClient) {
    result.keywords += keywords.length;
    const ranks = await naverResearch.rankCheck({ keywords, target: name, channel: "local" });
    if (!ranks.ok) {
      result.failed += keywords.length;
      continue;
    }
    for (const r of ranks.data) {
      if (r.rank == null) continue; // 노출 안 됨 — 저장 생략
      try {
        await db.placeRankRecord.upsert({
          where: { clientId_keyword_recordedOn: { clientId, keyword: r.keyword, recordedOn } },
          create: { clientId, keyword: r.keyword, rank: r.rank, recordedOn, memo: "auto:naver-local" },
          update: { rank: r.rank },
        });
        result.recorded++;
      } catch (e) {
        console.error("[place-rank] upsert failed", clientId, r.keyword, e);
        result.failed++;
      }
    }
  }

  return result;
}
