// 목표 경로: src/server/actions/time-logs.ts
//
// 업무 시간(공수) 기록 — 업무카드에 작업 시간을 분 단위로 남긴다.
// 권한: 업무 담당자(owner) 또는 관리자(SUPER_ADMIN/ADMIN). 삭제는 기록자 본인 또는 관리자.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const logSchema = z.object({
  workItemId: z.string().min(1),
  minutes: z.coerce.number().int().positive().max(24 * 60),
  note: z.string().trim().max(500).optional().nullable(),
  // 작업 날짜(YYYY-MM-DD). 없으면 오늘.
  workedOn: z.string().trim().optional().nullable()
});

export async function logWorkTime(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = logSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    const work = await db.workItem.findUnique({
      where: { id: d.workItemId },
      select: { id: true, ownerId: true, clientId: true }
    });
    if (!work) throw new Error("NOT_FOUND");
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && work.ownerId !== user.id) throw new Error("FORBIDDEN");

    const workedOn = d.workedOn ? new Date(d.workedOn) : new Date();
    if (Number.isNaN(workedOn.getTime())) throw new Error("VALIDATION");

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const log = await tx.timeLog.create({
        data: { workItemId: d.workItemId, userId: user.id, minutes: d.minutes, note: d.note || null, workedOn }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "timeLog.create",
        targetType: "TimeLog",
        targetId: log.id,
        afterState: { workItemId: d.workItemId, minutes: d.minutes },
        ...meta
      });
      return log;
    });

    revalidatePath("/work");
    return { id: saved.id };
  });
}

export async function deleteTimeLog(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.timeLog.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && existing.userId !== user.id) throw new Error("FORBIDDEN");

    await db.timeLog.delete({ where: { id: p.data.id } });
    revalidatePath("/work");
  });
}
