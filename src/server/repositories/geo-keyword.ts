// GEO 키워드 선택 조회 — 거래처 스코프. 표는 채택(selected) 우선, 검색량 내림차순.
import { db } from "@/server/db";

export type GeoKeywordRow = {
  id: string;
  term: string;
  volume: number | null;
  source: string; // SEED | RELATED
  selected: boolean;
};

export async function listGeoKeywords(clientId: string): Promise<GeoKeywordRow[]> {
  try {
    const rows = await db.geoKeyword.findMany({
      where: { clientId },
      orderBy: [{ selected: "desc" }, { volume: "desc" }, { term: "asc" }]
    });
    return rows.map((r) => ({ id: r.id, term: r.term, volume: r.volume, source: r.source, selected: r.selected }));
  } catch {
    // 테이블 미생성(마이그레이션 지연) 등에도 화면이 죽지 않게.
    return [];
  }
}

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
