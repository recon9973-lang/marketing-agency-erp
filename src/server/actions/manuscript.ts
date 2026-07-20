"use server";

// 원고 스튜디오 — 거래처별 집필 프로젝트(프롬프트) CRUD. 실제 콘텐츠 생성은 GEO(콘텐츠 생성)에서 진행.
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { getDefaultOrgId } from "@/server/org";

async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "ManuscriptProject" ("id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "name" TEXT NOT NULL, "prompt" TEXT NOT NULL DEFAULT '', "notes" TEXT, "orgId" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ManuscriptProject_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ManuscriptProject_clientId_idx" ON "ManuscriptProject" ("clientId")`);
  } catch (e) {
    console.warn("[manuscript] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

export async function createManuscriptProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ clientId: z.string().min(1), name: z.string().min(1), prompt: z.string().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTable();
    const orgId = await getDefaultOrgId().catch(() => null);
    const row = await db.manuscriptProject.create({
      data: { clientId: p.data.clientId, name: p.data.name.trim(), prompt: p.data.prompt ?? "", orgId: orgId ?? undefined, createdById: user.id }
    });
    return { id: row.id };
  });
}

export async function updateManuscriptProject(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1), name: z.string().optional(), prompt: z.string().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.manuscriptProject.update({
      where: { id: p.data.id },
      data: {
        ...(p.data.name !== undefined ? { name: p.data.name.trim() } : {}),
        ...(p.data.prompt !== undefined ? { prompt: p.data.prompt } : {})
      }
    });
  });
}

export async function deleteManuscriptProject(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.manuscriptProject.delete({ where: { id: p.data.id } });
  });
}
