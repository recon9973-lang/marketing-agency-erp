// src/server/repositories/exposure.ts
//
// 노출 트래커 조회 — 거래처의 키워드 + 월보장 설정 + 채널별 최신 노출 스냅샷.
// guard-rank 잡이 적재한 ExposureSnapshot을 화면(거래처 상세)에서 읽는다.

import { db } from "@/server/db";

export type ExposureLatest = { channel: string; rank: number | null; checkedOn: string };
export type GuardKeywordRow = {
  id: string;
  keyword: string;
  isGuaranteed: boolean;
  targetRank: number | null;
  guardChannel: string;
  guardTarget: string | null;
  latest: ExposureLatest[]; // 채널별 최신 1건
};

/** 거래처의 키워드 목록(월보장 우선) + 채널별 최신 노출 스냅샷. */
export async function getExposureTracker(clientId: string): Promise<GuardKeywordRow[]> {
  const rows = await db.keyword.findMany({
    where: { clientId },
    orderBy: [{ isGuaranteed: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      keyword: true,
      isGuaranteed: true,
      targetRank: true,
      guardChannel: true,
      guardTarget: true,
      snapshots: {
        orderBy: { checkedOn: "desc" },
        take: 12,
        select: { channel: true, rank: true, checkedOn: true },
      },
    },
    take: 200,
  });

  return rows.map((r) => {
    const seen = new Set<string>();
    const latest: ExposureLatest[] = [];
    for (const s of r.snapshots) {
      if (seen.has(s.channel)) continue;
      seen.add(s.channel);
      latest.push({ channel: s.channel, rank: s.rank, checkedOn: s.checkedOn.toISOString().slice(0, 10) });
    }
    return {
      id: r.id,
      keyword: r.keyword,
      isGuaranteed: r.isGuaranteed,
      targetRank: r.targetRank,
      guardChannel: r.guardChannel,
      guardTarget: r.guardTarget,
      latest,
    };
  });
}
