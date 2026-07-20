// 개인 즐겨찾기(페이지 북마크) 조회.
import { db } from "@/server/db";

export type FavoriteRow = { id: string; label: string; href: string };

export async function listUserFavorites(userId: string): Promise<FavoriteRow[]> {
  try {
    const rows = await db.userFavorite.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({ id: r.id, label: r.label, href: r.href }));
  } catch {
    return [];
  }
}
