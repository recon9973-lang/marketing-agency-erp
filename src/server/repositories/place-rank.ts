import { db } from "@/server/db";

export type PlaceRankListItem = {
  id: string;
  keyword: string;
  rank: number;
  recordedOn: Date;
  memo: string | null;
  createdByName: string | null;
};

export type PlaceRankUpsertInput = {
  clientId: string;
  keyword: string;
  rank: number;
  recordedOn: Date;
  memo: string | null;
};

/** 같은 거래처·키워드·날짜 기록은 덮어쓴다(하루 1건). */
export async function upsertPlaceRank(input: PlaceRankUpsertInput, userId: string) {
  return db.placeRankRecord.upsert({
    where: {
      clientId_keyword_recordedOn: {
        clientId: input.clientId,
        keyword: input.keyword,
        recordedOn: input.recordedOn
      }
    },
    create: {
      clientId: input.clientId,
      keyword: input.keyword,
      rank: input.rank,
      recordedOn: input.recordedOn,
      memo: input.memo,
      createdById: userId
    },
    update: {
      rank: input.rank,
      memo: input.memo,
      createdById: userId
    },
    select: { id: true }
  });
}

export async function listPlaceRanks(
  clientId: string,
  filters: { keyword?: string } = {}
): Promise<PlaceRankListItem[]> {
  const records = await db.placeRankRecord.findMany({
    where: {
      clientId,
      ...(filters.keyword ? { keyword: filters.keyword } : {})
    },
    orderBy: [{ recordedOn: "desc" }, { keyword: "asc" }],
    take: 300,
    select: {
      id: true,
      keyword: true,
      rank: true,
      recordedOn: true,
      memo: true,
      createdBy: { select: { name: true } }
    }
  });

  return records.map((record) => ({
    id: record.id,
    keyword: record.keyword,
    rank: record.rank,
    recordedOn: record.recordedOn,
    memo: record.memo,
    createdByName: record.createdBy?.name ?? null
  }));
}

export async function listPlaceRankKeywords(clientId: string): Promise<string[]> {
  const rows = await db.placeRankRecord.findMany({
    where: { clientId },
    distinct: ["keyword"],
    orderBy: { keyword: "asc" },
    select: { keyword: true }
  });

  return rows.map((row) => row.keyword);
}

export async function getPlaceRankAccessInfo(placeRankId: string) {
  return db.placeRankRecord.findUnique({
    where: { id: placeRankId },
    select: { id: true, clientId: true, keyword: true, rank: true, recordedOn: true }
  });
}

export async function deletePlaceRank(placeRankId: string) {
  return db.placeRankRecord.delete({ where: { id: placeRankId }, select: { id: true } });
}
