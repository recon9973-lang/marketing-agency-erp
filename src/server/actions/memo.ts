"use server";

// 개인 메모장 저장 — 로그인한 사용자 본인 메모(계정별 1개, upsert).
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "UserMemo" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "content" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserMemo_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UserMemo_userId_key" ON "UserMemo" ("userId")`);
  } catch (e) {
    console.warn("[memo] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

export async function saveMemo(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ content: z.string().max(20000) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTable();
    await db.userMemo.upsert({
      where: { userId: user.id },
      update: { content: p.data.content },
      create: { userId: user.id, content: p.data.content }
    });
  });
}
