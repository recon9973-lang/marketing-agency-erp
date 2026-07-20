"use server";

// 아이디어 노트 — 러프 아이디어 저장 + AI 실행계획서 생성/편집/삭제.
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { Role } from "@/domain/types";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { generateExecutionPlan } from "@/server/ai/claude";

async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "IdeaNote" ("id" TEXT NOT NULL, "authorId" TEXT NOT NULL, "clientId" TEXT, "title" TEXT NOT NULL, "idea" TEXT NOT NULL DEFAULT '', "goal" TEXT, "audience" TEXT, "constraints" TEXT, "success" TEXT, "plan" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "IdeaNote_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IdeaNote_authorId_idx" ON "IdeaNote" ("authorId")`);
  } catch (e) {
    console.warn("[idea] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

const upsertSchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  idea: z.string().trim().max(4000).optional(),
  goal: z.string().trim().max(1000).optional().nullable(),
  audience: z.string().trim().max(1000).optional().nullable(),
  constraints: z.string().trim().max(1000).optional().nullable(),
  success: z.string().trim().max(1000).optional().nullable(),
  clientId: z.string().trim().optional().nullable()
});

/** 아이디어 저장(신규/수정). */
export async function saveIdea(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = upsertSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTable();
    const d = p.data;
    const data = {
      title: d.title.trim(),
      idea: d.idea?.trim() ?? "",
      goal: d.goal?.trim() || null,
      audience: d.audience?.trim() || null,
      constraints: d.constraints?.trim() || null,
      success: d.success?.trim() || null,
      clientId: d.clientId?.trim() || null
    };
    if (d.id) {
      const owned = await db.ideaNote.findUnique({ where: { id: d.id }, select: { authorId: true } });
      if (!owned || owned.authorId !== user.id) throw new Error("FORBIDDEN");
      await db.ideaNote.update({ where: { id: d.id }, data });
      revalidatePath("/ideas");
      return { id: d.id };
    }
    const row = await db.ideaNote.create({ data: { authorId: user.id, ...data }, select: { id: true } });
    revalidatePath("/ideas");
    return { id: row.id };
  });
}

/** AI 실행계획서 생성 — 저장된 아이디어 기준. plan에 저장하고 반환. */
export async function generateIdeaPlan(input: unknown): Promise<ActionResult<{ plan: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const idea = await db.ideaNote.findUnique({ where: { id: p.data.id } });
    if (!idea || idea.authorId !== user.id) throw new Error("FORBIDDEN");

    let clientName: string | null = null;
    if (idea.clientId) {
      const c = await db.client.findUnique({ where: { id: idea.clientId }, select: { name: true } });
      clientName = c?.name ?? null;
    }

    // 키 없으면 AI_NOT_CONFIGURED throw(상위에서 안내).
    const plan = await generateExecutionPlan({
      title: idea.title,
      idea: idea.idea,
      goal: idea.goal,
      audience: idea.audience,
      constraints: idea.constraints,
      success: idea.success,
      clientName
    });

    await db.ideaNote.update({ where: { id: idea.id }, data: { plan, status: "PLANNED" } });
    revalidatePath("/ideas");
    return { plan };
  });
}

/** 계획서 본문 직접 편집 저장. */
export async function updateIdeaPlan(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1), plan: z.string().max(40000) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const owned = await db.ideaNote.findUnique({ where: { id: p.data.id }, select: { authorId: true } });
    if (!owned || owned.authorId !== user.id) throw new Error("FORBIDDEN");
    await db.ideaNote.update({ where: { id: p.data.id }, data: { plan: p.data.plan } });
    revalidatePath("/ideas");
  });
}

export async function deleteIdea(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const owned = await db.ideaNote.findUnique({ where: { id: p.data.id }, select: { authorId: true } });
    // 작성자 본인 또는 최고관리자.
    if (!owned || (owned.authorId !== user.id && user.role !== Role.SUPER_ADMIN)) throw new Error("FORBIDDEN");
    await db.ideaNote.delete({ where: { id: p.data.id } });
    revalidatePath("/ideas");
  });
}
