import { db } from "@/server/db";

/** 사용자가 즐겨찾기한 거래처 id 목록. */
export async function listFavoriteClientIds(userId: string): Promise<string[]> {
  const rows = await db.clientFavorite.findMany({
    where: { userId },
    select: { clientId: true }
  });

  return rows.map((row) => row.clientId);
}

export async function isFavoriteClient(userId: string, clientId: string): Promise<boolean> {
  const found = await db.clientFavorite.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { id: true }
  });

  return Boolean(found);
}

/** 즐겨찾기 토글. 반환값은 토글 후 상태(true=즐겨찾기됨). */
export async function toggleFavoriteClient(userId: string, clientId: string): Promise<boolean> {
  const existing = await db.clientFavorite.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { id: true }
  });

  if (existing) {
    await db.clientFavorite.delete({ where: { id: existing.id } });
    return false;
  }

  await db.clientFavorite.create({ data: { userId, clientId } });
  return true;
}
