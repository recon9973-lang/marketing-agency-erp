"use server";

// 내부 공지사항 — 관리자가 작성/삭제. 전 직원에게 대시보드에서 게시된다.
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "InternalNotice" ("id" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "authorId" TEXT, "authorName" TEXT, "pinned" BOOLEAN NOT NULL DEFAULT false, "orgId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InternalNotice_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InternalNotice_createdAt_idx" ON "InternalNotice" ("createdAt")`);
  } catch (e) {
    console.warn("[notices] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

export async function createInternalNotice(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ title: z.string().trim().min(1).max(200), body: z.string().trim().min(1), pinned: z.boolean().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTable();
    const orgId = await getDefaultOrgId().catch(() => null);
    const row = await db.internalNotice.create({
      data: { title: p.data.title, body: p.data.body, pinned: p.data.pinned ?? false, authorId: user.id, authorName: user.name, orgId: orgId ?? undefined }
    });
    return { id: row.id };
  });
}

export async function deleteInternalNotice(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.internalNotice.delete({ where: { id: p.data.id } });
  });
}
