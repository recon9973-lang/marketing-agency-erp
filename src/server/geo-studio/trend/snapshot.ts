// GEO Studio P3b — 브랜드 검색지수 스냅샷 순수 요약(DB 무관, 테스트 가능).
// 저장된 스냅샷(브랜드 키워드) 이력을 시간순으로 정렬하고 직전 저장 대비 변화를 계산.

export type SnapshotRow = { capturedAt: Date; latestRatio: number | null };
export type HistoryPoint = { capturedAt: Date; ratio: number | null; deltaVsPrev: number | null };

/** 브랜드 스냅샷 이력 → 시간순 + 직전 저장 대비 delta. */
export function summarizeHistory(rows: SnapshotRow[]): HistoryPoint[] {
  const sorted = [...rows].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  return sorted.map((r, i) => {
    const prev = i > 0 ? sorted[i - 1].latestRatio : null;
    const deltaVsPrev = r.latestRatio != null && prev != null ? Math.round((r.latestRatio - prev) * 10) / 10 : null;
    return { capturedAt: r.capturedAt, ratio: r.latestRatio, deltaVsPrev };
  });
}
