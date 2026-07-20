"use server";

// 개인 즐겨찾기(페이지 북마크) 토글 — 로그인 사용자 본인 계정.
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "UserFavorite" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "label" TEXT NOT NULL, "href" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UserFavorite_userId_href_key" ON "UserFavorite" ("userId", "href")`);
  } catch (e) {
    console.warn("[favorites] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

export async function toggleUserFavorite(input: unknown): Promise<ActionResult<{ favorited: boolean }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ label: z.string().trim().min(1).max(60), href: z.string().trim().min(1).max(200) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTable();
    const existing = await db.userFavorite.findUnique({ where: { userId_href: { userId: user.id, href: p.data.href } } }).catch(() => null);
    if (existing) {
      await db.userFavorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await db.userFavorite.create({ data: { userId: user.id, label: p.data.label, href: p.data.href } });
    return { favorited: true };
  });
}
