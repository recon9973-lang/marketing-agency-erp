// 내부 공지사항 조회 — 고정(pinned) 우선, 최신순.
import { db } from "@/server/db";

export type InternalNoticeRow = {
  id: string;
  title: string;
  body: string;
  authorName: string | null;
  pinned: boolean;
  createdAt: string;
};

export async function listInternalNotices(limit = 20): Promise<InternalNoticeRow[]> {
  try {
    const rows = await db.internalNotice.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: limit });
    return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, authorName: r.authorName, pinned: r.pinned, createdAt: r.createdAt.toISOString() }));
  } catch {
    return [];
  }
}
