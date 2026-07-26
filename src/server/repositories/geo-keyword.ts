// GEO 키워드 선택 조회 — 거래처 스코프. 표는 채택(selected) 우선, 검색량 내림차순.
import { db } from "@/server/db";

export type GeoKeywordRow = {
  id: string;
  term: string;
  volume: number | null;
  source: string; // SEED | RELATED
  selected: boolean;
};


export async function listSelectedGeoKeywords(clientId: string): Promise<string[]> {
  try {
    const rows = await db.geoKeyword.findMany({
      where: { clientId, selected: true },
      orderBy: [{ volume: "desc" }],
      select: { term: true }
    });
    return rows.map((r) => r.term);
  } catch {
    return [];
  }
}
