"use server";

// 인사관리평가 — 관리자가 직원을 주기별로 평가(생성/수정/삭제).
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { Role } from "@/domain/types";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "HrEvaluation" ("id" TEXT NOT NULL, "evaluateeId" TEXT NOT NULL, "evaluatorId" TEXT, "period" TEXT NOT NULL, "performance" INTEGER NOT NULL DEFAULT 3, "collaboration" INTEGER NOT NULL DEFAULT 3, "diligence" INTEGER NOT NULL DEFAULT 3, "expertise" INTEGER NOT NULL DEFAULT 3, "attitude" INTEGER NOT NULL DEFAULT 3, "strengths" TEXT, "improvements" TEXT, "comment" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "HrEvaluation_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HrEvaluation_evaluateeId_idx" ON "HrEvaluation" ("evaluateeId")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HrEvaluation_period_idx" ON "HrEvaluation" ("period")`);
  } catch (e) {
    console.warn("[hr-eval] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

const score = z.coerce.number().int().min(1).max(5);
const saveSchema = z.object({
  id: z.string().optional().nullable(),
  evaluateeId: z.string().min(1),
  period: z.string().trim().min(1).max(40),
  performance: score,
  collaboration: score,
  diligence: score,
  expertise: score,
  attitude: score,
  strengths: z.string().max(2000).optional().nullable(),
  improvements: z.string().max(2000).optional().nullable(),
  comment: z.string().max(2000).optional().nullable()
});

function assertManager(role: Role) {
  if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) throw new Error("FORBIDDEN");
}

export async function saveHrEvaluation(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const p = saveSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTable();
    const d = p.data;
    const data = {
      period: d.period.trim(),
      performance: d.performance,
      collaboration: d.collaboration,
      diligence: d.diligence,
      expertise: d.expertise,
      attitude: d.attitude,
      strengths: d.strengths || null,
      improvements: d.improvements || null,
      comment: d.comment || null
    };
    if (d.id) {
      await db.hrEvaluation.update({ where: { id: d.id }, data });
      revalidatePath("/settings");
      return { id: d.id };
    }
    const row = await db.hrEvaluation.create({
      data: { evaluateeId: d.evaluateeId, evaluatorId: user.id, ...data },
      select: { id: true }
    });
    revalidatePath("/settings");
    return { id: row.id };
  });
}

export async function deleteHrEvaluation(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.hrEvaluation.delete({ where: { id: p.data.id } });
    revalidatePath("/settings");
  });
}
