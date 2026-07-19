// GEO Studio P3b — 브랜드 검색지수 스냅샷 조회.
import { db } from "@/server/db";

export type BrandSnapshotRow = { capturedAt: Date; latestRatio: number | null; keyword: string };

/** 브랜드+카테고리의 '브랜드 키워드' 스냅샷 이력(최신순, 기본 12건). */
export async function listBrandSnapshots(brand: string, category: string, limit = 12): Promise<BrandSnapshotRow[]> {
  if (!brand || !category) return [];
  return db.trendSnapshot.findMany({
    where: { brand, category, role: "brand" },
    orderBy: { capturedAt: "desc" },
    take: limit,
    select: { capturedAt: true, latestRatio: true, keyword: true }
  });
}
