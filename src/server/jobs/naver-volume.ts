// src/server/jobs/naver-volume.ts
//
// 네이버 6단계 ④ 후속 — 검색량 미상(searchVolume=null) 키워드를 배치로 보강.
// 검색광고 keywordstool은 호출당 hintKeywords 5개 제한이라 5개씩 청크로 순차 처리한다
// (요청-응답 사이클이 아니라 백그라운드/크론에서 실행 → 타임아웃·429 회피).
// 조회 성공분만 searchVolume+grade+competition 갱신(멱등, 부분 실패 격리).

import { db } from "@/server/db";
import { fetchKeywordVolumes } from "@/server/integrations/naver-search";
import { gradeByVolume } from "@/domain/marketing/keyword-grade";

export type NaverVolumeResult = { processed: number; updated: number; failed: number };

const CHUNK = 5;

export async function runNaverVolumeEnrich(clientId: string, limit = 200): Promise<NaverVolumeResult> {
  const pending = await db.keyword.findMany({
    where: { clientId, searchVolume: null },
    select: { id: true, keyword: true },
    take: limit
  });
  const result: NaverVolumeResult = { processed: pending.length, updated: 0, failed: 0 };

  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    let vols;
    try {
      vols = await fetchKeywordVolumes(chunk.map((k) => k.keyword));
    } catch {
      result.failed += chunk.length; // 청크 실패 격리 — 다음 청크 계속
      continue;
    }
    const byKw = new Map(vols.map((v) => [v.keyword.replace(/\s+/g, ""), v]));
    for (const k of chunk) {
      const v = byKw.get(k.keyword.replace(/\s+/g, ""));
      if (!v || v.total == null) continue;
      await db.keyword.update({
        where: { id: k.id },
        data: { searchVolume: v.total, grade: gradeByVolume(v.total), competition: v.competition ?? undefined }
      });
      result.updated++;
    }
  }
  return result;
}
