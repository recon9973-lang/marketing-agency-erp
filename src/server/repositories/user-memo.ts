// 개인 메모장 조회 — 계정별 1개.
import { db } from "@/server/db";

export async function getUserMemo(userId: string): Promise<string> {
  try {
    const row = await db.userMemo.findUnique({ where: { userId }, select: { content: true } });
    return row?.content ?? "";
  } catch {
    return "";
  }
}
